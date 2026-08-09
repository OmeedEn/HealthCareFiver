import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import * as medallion from '@/lib/integrations/medallion'
import * as checkr from '@/lib/integrations/background-check'
import * as stripeIdentity from '@/lib/integrations/stripe-identity'

type CheckType = 'medallion' | 'checkr' | 'stripe_identity'

const CHECK_TYPES: CheckType[] = ['medallion', 'checkr', 'stripe_identity']

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contractorId: string }> }
) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const { contractorId } = await params
  const body = await request.json().catch(() => ({}))
  const checkType = body.checkType as CheckType

  if (!CHECK_TYPES.includes(checkType)) {
    return NextResponse.json({ error: 'Invalid checkType' }, { status: 400 })
  }

  const adminSupabase = createAdminClient()

  const { data: contractor, error: contractorError } = await adminSupabase
    .from('contractor_profiles')
    .select('id, first_name, last_name, npi_number, state_license_number, license_state')
    .eq('id', contractorId)
    .single()

  if (contractorError || !contractor) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
  }

  const { data: profileRow } = await adminSupabase
    .from('profiles')
    .select('email')
    .eq('id', contractorId)
    .single()

  const email = profileRow?.email ?? ''

  const { data: existingCheck } = await adminSupabase
    .from('provider_verification_checks')
    .select('*')
    .eq('contractor_id', contractorId)
    .eq('check_type', checkType)
    .maybeSingle()

  let update: {
    status: string
    external_id?: string
    result_summary?: unknown
    raw_response?: unknown
    checked_at: string
  }

  try {
    if (!existingCheck?.external_id) {
      update = await initiateCheck(checkType, contractor, email)
    } else {
      update = await refreshCheck(checkType, existingCheck.external_id)
    }
  } catch (err) {
    console.error(`[verification] Failed to run ${checkType} check`, err)
    return NextResponse.json(
      { error: `Failed to run ${checkType} check` },
      { status: 502 }
    )
  }

  const { data: saved, error: upsertError } = await adminSupabase
    .from('provider_verification_checks')
    .upsert(
      {
        contractor_id: contractorId,
        check_type: checkType,
        ...update,
      },
      { onConflict: 'contractor_id,check_type' }
    )
    .select()
    .single()

  if (upsertError) {
    return NextResponse.json(
      { error: 'Failed to save check result' },
      { status: 500 }
    )
  }

  return NextResponse.json({ check: saved })
}

async function initiateCheck(
  checkType: CheckType,
  contractor: {
    id: string
    first_name: string
    last_name: string
    npi_number: string | null
    state_license_number: string | null
    license_state: string | null
  },
  email: string
) {
  const checkedAt = new Date().toISOString()

  if (checkType === 'medallion') {
    const result = await medallion.createVerification({
      externalId: contractor.id,
      firstName: contractor.first_name,
      lastName: contractor.last_name,
      email,
      npiNumber: contractor.npi_number,
      licenseNumber: contractor.state_license_number,
      licenseState: contractor.license_state,
    })
    return {
      status: mapMedallionStatus(result.status),
      external_id: result.verificationId,
      result_summary: { status: result.status },
      checked_at: checkedAt,
    }
  }

  if (checkType === 'stripe_identity') {
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/contractor/dashboard`
    const result = await stripeIdentity.createVerificationSession({
      contractorId: contractor.id,
      returnUrl,
    })
    return {
      status: mapStripeIdentityStatus(result.status),
      external_id: result.sessionId,
      result_summary: { status: result.status, url: result.url },
      checked_at: checkedAt,
    }
  }

  // checkr — note: the app doesn't currently collect DOB/SSN from
  // providers, so this initiates with placeholders. Only meaningful once
  // a real CHECKR_API_KEY is configured and those fields are collected.
  const candidate = await checkr.createCandidate({
    first_name: contractor.first_name,
    last_name: contractor.last_name,
    email,
    dob: '',
    ssn: '',
  })
  const invitation = await checkr.createInvitation(candidate.id)
  return {
    status: 'pending' as const,
    external_id: invitation.id,
    result_summary: { invitationStatus: invitation.status },
    checked_at: checkedAt,
  }
}

async function refreshCheck(checkType: CheckType, externalId: string) {
  const checkedAt = new Date().toISOString()

  if (checkType === 'medallion') {
    const result = await medallion.getVerificationStatus(externalId)
    return {
      status: mapMedallionStatus(result.status),
      result_summary: {
        status: result.status,
        licenseValid: result.licenseValid,
        sanctionsClear: result.sanctionsClear,
        exclusionsClear: result.exclusionsClear,
        notes: result.notes,
      },
      raw_response: result,
      checked_at: checkedAt,
    }
  }

  if (checkType === 'stripe_identity') {
    const result = await stripeIdentity.getVerificationSession(externalId)
    return {
      status: mapStripeIdentityStatus(result.status),
      result_summary: {
        status: result.status,
        verifiedOutputs: result.verifiedOutputs,
        lastError: result.lastError,
      },
      raw_response: result,
      checked_at: checkedAt,
    }
  }

  const report = await checkr.getReport(externalId)
  return {
    status: mapCheckrStatus(report.status, report.result),
    result_summary: { status: report.status, result: report.result },
    raw_response: report,
    checked_at: checkedAt,
  }
}

function mapMedallionStatus(status: string): string {
  if (status === 'verified') return 'passed'
  if (status === 'flagged' || status === 'failed') return 'failed'
  if (status === 'needs_review') return 'needs_review'
  return 'pending'
}

function mapStripeIdentityStatus(status: string): string {
  if (status === 'verified') return 'passed'
  if (status === 'canceled') return 'failed'
  if (status === 'needs_review') return 'needs_review'
  return 'pending'
}

function mapCheckrStatus(status: string, result: string | null): string {
  if (status === 'complete') {
    if (result === 'clear') return 'passed'
    if (result === 'consider' || result === 'suspended') return 'needs_review'
    return 'failed'
  }
  return 'pending'
}
