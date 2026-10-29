import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Clock } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { isDemoMode, DEMO_CONTRACTOR, DEMO_FACILITY } from '@/lib/demo/data'
import { CONTRACTOR_AGREEMENT_VERSION } from '@/lib/legal'
import { listOwnListings } from '@/lib/listings/data'
import { listingIsComplete, type ListingRow } from '@/lib/listings/offering'
import {
  listingIsComplete as orgListingIsComplete,
  type ListingRow as OrgListingRow,
} from '@/app/onboarding/organization/listing-draft'
import { getProgress } from '@/lib/onboarding/progress'
import { isStripeConfigured } from '@/lib/stripe/connect'
import { ProGoLiveFlow, type GoLiveStep, type ProGoLiveProps } from './pro-flow'
import { OrgGoLiveFlow, type OrgGoLiveProps } from './org-flow'
import { Shell } from './ui'

export const metadata: Metadata = {
  title: 'Go live — Sanus',
}

/*
 * /go-live: everything after approval, one screen at a time, for
 * professionals and organizations (the approval emails link here).
 *   Professionals: contractor agreement → payouts → first listing → done.
 *   Organizations: Organization Agreement → payouts → first service or event → done.
 * Agreements can't be skipped; payouts and the first listing can (they stay
 * on the Finish your profile checklist, which links back with ?step=).
 * Stripe returns here with ?payouts=done.
 */

type Params = { [key: string]: string | string[] | undefined }

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const STEPS: readonly GoLiveStep[] = ['agreement', 'payouts', 'listing']

/**
 * Back from Stripe-hosted onboarding: the account.updated webhook normally
 * flips stripe_connect_onboarded, but it can lag (or be missing in local
 * dev), so check the account directly once.
 */
async function syncPayouts(userId: string, connectId: string | null): Promise<boolean> {
  if (!connectId || !isStripeConfigured()) return false
  try {
    const { getAccountStatus } = await import('@/lib/stripe/connect')
    if (!(await getAccountStatus(connectId)).ready) return false
    const { createAdminClient } = await import('@/lib/supabase/admin')
    // stripe_connect_onboarded is a protected billing column — service role only.
    const { error } = await createAdminClient()
      .from('profiles')
      .update({ stripe_connect_onboarded: true })
      .eq('id', userId)
    if (error) {
      console.error('[go-live] Failed to persist Connect onboarding', error)
      return false
    }
    return true
  } catch (err) {
    console.error('[go-live] Failed to check Stripe Connect status', err)
    return false
  }
}

const NOT_APPROVED_COPY: Record<string, { title: string; body: string }> = {
  more_info_requested: {
    title: 'We need a bit more information',
    body: 'Our review team asked for more information before approving your credentials. Upload what they need and we’ll pick your review back up.',
  },
  needs_info: {
    title: 'We need a bit more information',
    body: 'Our review team asked for more information before approving your organization. See the note on your dashboard.',
  },
  rejected: {
    title: 'Your application wasn’t approved',
    body: 'We weren’t able to approve your application. Check your email or dashboard for details from our review team.',
  },
  suspended: {
    title: 'Your account is on hold',
    body: 'Check your email or dashboard for details from our review team.',
  },
  pending_review: {
    title: 'Your application is in review',
    body: 'We review every application within 24-48 hours. You’ll get an email when you’re approved. Then come back here to finish going live.',
  },
}

const DEFAULT_NOT_APPROVED = {
  title: 'Finish your application first',
  body: 'Once your application is submitted and approved, you can accept the agreement, set up payouts, and add your first listing here.',
}

function NotApproved({ status }: { status: string | null }) {
  const copy = (status && NOT_APPROVED_COPY[status]) || DEFAULT_NOT_APPROVED
  return (
    <Shell exit={false}>
      <div className="rounded-2xl border border-[#e4e5e7] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e8faf1]">
          <Clock className="h-7 w-7 text-[#1dbf73]" />
        </div>
        <h1 className="mt-4 text-2xl font-black tracking-tight text-[#404145]">{copy.title}</h1>
        <p className="mt-2 text-sm text-[#62646a]">{copy.body}</p>
        <div className="mt-6 flex flex-col gap-3">
          {status === 'more_info_requested' && (
            <Button
              className="h-11 w-full bg-[#1dbf73] text-sm font-bold text-white hover:bg-[#19a463]"
              render={<Link href="/contractor/credentials/upload" />}
            >
              Upload documents
            </Button>
          )}
          <Button variant="outline" className="h-11 w-full text-sm font-semibold" render={<Link href="/dashboard" />}>
            Go to dashboard
          </Button>
        </div>
      </div>
    </Shell>
  )
}

/* ───────────── Professionals ───────────── */

async function loadPro(
  supabase: SupabaseClient,
  userId: string,
  connectId: string | null,
  onboarded: boolean,
  payoutsReturn: boolean,
  step: GoLiveStep | null
): Promise<ProGoLiveProps | { notApproved: string | null }> {
  // select('*') so this page keeps rendering if the agreement columns
  // haven't been migrated yet (they just read as undefined).
  const [{ data: contractor }, listings, progress] = await Promise.all([
    supabase.from('contractor_profiles').select('*').eq('id', userId).maybeSingle(),
    listOwnListings(supabase, userId),
    getProgress(supabase, userId, 'professional'),
  ])
  const status = (contractor?.verification_status as string | null) ?? null
  // 'insurance_pending' providers are approved and live for listings that
  // don't need malpractice coverage.
  if (status !== 'approved' && status !== 'insurance_pending') return { notApproved: status }

  let payoutsOnboarded = onboarded
  if (payoutsReturn && !payoutsOnboarded) payoutsOnboarded = await syncPayouts(userId, connectId)

  const acceptedAt = (contractor?.contractor_agreement_accepted_at as string | null | undefined) ?? null
  const version = (contractor?.contractor_agreement_version as string | null | undefined) ?? null
  const agreementCurrent = acceptedAt !== null && version === CONTRACTOR_AGREEMENT_VERSION
  const insuranceDueAt =
    status === 'insurance_pending' ? ((contractor?.insurance_due_at as string | null | undefined) ?? null) : null

  return {
    firstName: (contractor?.first_name as string | null) ?? '',
    agreementCurrent,
    agreementOutdated: acceptedAt !== null && !agreementCurrent,
    insured: contractor?.insured_verified_at != null,
    insurancePending: status === 'insurance_pending',
    insuranceDue: insuranceDueAt ? formatDate(insuranceDueAt) : null,
    hasConnectAccount: connectId !== null,
    payoutsOnboarded,
    step,
    ...listingPlan(listings, progress.skipped, step, payoutsReturn, payoutsOnboarded),
  }
}

function listingPlan(
  listings: ListingRow[],
  skipped: string[],
  step: GoLiveStep | null,
  payoutsReturn: boolean,
  payoutsOnboarded: boolean
) {
  const finished = listings.filter((l) => l.status !== 'draft' || listingIsComplete(l))
  const hasListing = finished.length > 0
  const submitted = listings.some((l) => l.status !== 'draft')
  return {
    showPayouts:
      !payoutsOnboarded &&
      (isStripeConfigured() || isDemoMode()) &&
      (!skipped.includes('go_live_payouts') || step === 'payouts' || payoutsReturn),
    payoutsReturned: payoutsReturn && !payoutsOnboarded,
    showListing: !hasListing && (!skipped.includes('go_live_listing') || step === 'listing'),
    // listOwnListings is newest first.
    resumeListing: hasListing ? null : (listings.find((l) => l.status === 'draft') ?? null),
    draftToSubmit: submitted ? null : (finished.find((l) => l.status === 'draft')?.id ?? null),
    hasListing,
  }
}

/* ───────────── Organizations ───────────── */

async function loadOrg(
  supabase: SupabaseClient,
  userId: string,
  connectId: string | null,
  onboarded: boolean,
  payoutsReturn: boolean,
  step: GoLiveStep | null
): Promise<OrgGoLiveProps | { notApproved: string | null }> {
  const [{ data: org }, { data: rows }, progress] = await Promise.all([
    // Own row via RPC (review fields aren't all readable directly).
    supabase
      .rpc('my_facility_profile')
      .select('facility_name, verification_status, org_agreement_accepted_at')
      .maybeSingle<{ facility_name: string | null; verification_status: string | null; org_agreement_accepted_at: string | null }>(),
    supabase.from('org_listings').select('*').eq('facility_id', userId).order('created_at', { ascending: false }),
    getProgress(supabase, userId, 'organization'),
  ])
  if (org?.verification_status !== 'approved') return { notApproved: org?.verification_status ?? null }

  let payoutsOnboarded = onboarded
  if (payoutsReturn && !payoutsOnboarded) payoutsOnboarded = await syncPayouts(userId, connectId)

  const listings = (rows ?? []) as OrgListingRow[]
  const hasListing = listings.some((l) => l.status !== 'draft' || orgListingIsComplete(l))
  const skipped = progress.skipped
  return {
    orgName: org.facility_name ?? '',
    agreementAccepted: !!org.org_agreement_accepted_at,
    showPayouts:
      !payoutsOnboarded &&
      isStripeConfigured() &&
      (!skipped.includes('go_live_payouts') || step === 'payouts' || payoutsReturn),
    payoutsOnboarded,
    hasConnectAccount: connectId !== null,
    payoutsReturned: payoutsReturn && !payoutsOnboarded,
    showListing: !hasListing && (!skipped.includes('go_live_listing') || step === 'listing'),
    resumeListing: hasListing ? null : (listings.find((l) => l.status === 'draft') ?? null),
    hasListing,
    step,
  }
}

/* ───────────── Page ───────────── */

export default async function GoLivePage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams
  const payoutsReturn = params.payouts === 'done'
  const step = STEPS.find((s) => s === params.step) ?? null

  if (isDemoMode()) {
    const demoRole = (await cookies()).get('demo_role')?.value
    if (demoRole === 'facility') {
      return (
        <Shell>
          <OrgGoLiveFlow
            orgName={DEMO_FACILITY.facility_name}
            agreementAccepted={false}
            showPayouts
            payoutsOnboarded={false}
            hasConnectAccount={false}
            payoutsReturned={false}
            showListing
            resumeListing={null}
            hasListing={false}
            step={step}
          />
        </Shell>
      )
    }
    return (
      <Shell>
        <ProGoLiveFlow
          firstName={DEMO_CONTRACTOR.first_name}
          agreementCurrent={false}
          agreementOutdated={false}
          showPayouts
          payoutsOnboarded={false}
          hasConnectAccount={false}
          payoutsReturned={false}
          showListing
          resumeListing={null}
          draftToSubmit={null}
          hasListing={false}
          insured={false}
          insuranceDue={null}
          insurancePending={false}
          step={step}
        />
      </Shell>
    )
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/go-live')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, stripe_connect_id, stripe_connect_onboarded')
    .eq('id', user.id)
    .maybeSingle()
  const role = profile?.role as string | undefined
  const connectId = (profile?.stripe_connect_id as string | null) ?? null
  const onboarded = profile?.stripe_connect_onboarded === true
  const db = supabase as unknown as SupabaseClient

  if (role === 'contractor') {
    const data = await loadPro(db, user.id, connectId, onboarded, payoutsReturn, step)
    if ('notApproved' in data) return <NotApproved status={data.notApproved} />
    return (
      <Shell>
        <ProGoLiveFlow {...data} />
      </Shell>
    )
  }

  if (role === 'facility' || role === 'staffing_agency') {
    const data = await loadOrg(db, user.id, connectId, onboarded, payoutsReturn, step)
    if ('notApproved' in data) return <NotApproved status={data.notApproved} />
    return (
      <Shell>
        <OrgGoLiveFlow {...data} />
      </Shell>
    )
  }

  redirect('/dashboard')
}
