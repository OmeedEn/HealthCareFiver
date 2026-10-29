'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { currentUser } from '@/lib/auth/roles'
import { isDemoMode } from '@/lib/demo/data'
import { CONTRACTOR_AGREEMENT_VERSION } from '@/lib/legal'
import { recordProgress } from '@/lib/onboarding/progress'
import { acceptOrgAgreement as acceptOrgAgreementRpc } from '@/app/(dashboard)/facility/listings/actions'
import type { ActionResult } from '@/components/onboarding/question-flow'

/**
 * Accept the Independent Contractor and Platform Agreement. The write goes
 * through the accept_contractor_agreement RPC (SECURITY DEFINER), which
 * stamps contractor_agreement_accepted_at / _version and itself rejects
 * callers who aren't approved contractors — the columns are protected from
 * direct self-update. `agree` is the checkbox on the agreement screen.
 */
export async function acceptContractorAgreement(agree: boolean): Promise<ActionResult> {
  if (agree !== true) {
    return { ok: false, error: 'Please check the box to agree before continuing.' }
  }
  if (isDemoMode()) return { ok: true }

  // currentUser() enforces AAL2 (MFA).
  const user = await currentUser()
  if (!user || user.role !== 'contractor') {
    return { ok: false, error: 'You must be signed in as a professional to accept the agreement.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('accept_contractor_agreement', {
    p_version: CONTRACTOR_AGREEMENT_VERSION,
  })

  if (error) {
    console.error('[go-live] accept_contractor_agreement failed', error)
    return {
      ok: false,
      error:
        error.code === '42501'
          ? 'Your credentials must be approved before you can accept the agreement.'
          : 'We couldn’t record your agreement. Please try again.',
    }
  }

  revalidatePath('/dashboard')
  return { ok: true }
}

/**
 * Accept the Organization Agreement (same accept_org_agreement RPC and
 * version as the agreement card on the dashboard and Services & events).
 */
export async function acceptOrgAgreement(agree: boolean): Promise<ActionResult> {
  if (agree !== true) {
    return { ok: false, error: 'Please check the box to agree before continuing.' }
  }
  if (isDemoMode()) return { ok: true }
  const user = await currentUser()
  if (!user || (user.role !== 'facility' && user.role !== 'staffing_agency')) {
    return { ok: false, error: 'You must be signed in as an organization to accept the agreement.' }
  }
  const res = await acceptOrgAgreementRpc()
  return res.ok ? { ok: true } : { ok: false, error: res.error ?? 'We couldn’t save that. Please try again.' }
}

/** go-live screens that can be skipped ("Skip for now"); remembered so a return visit moves past them. */
const SKIPPABLE = new Set(['go_live_payouts', 'go_live_listing'])

/**
 * Remember a skipped go-live screen (onboarding_progress, the account's own
 * flow). Payouts and the first listing stay on the Finish your profile
 * checklist, which links back to that screen.
 */
export async function skipGoLiveScreen(id: string): Promise<ActionResult> {
  if (!SKIPPABLE.has(id)) return { ok: false, error: 'This step can’t be skipped.' }
  if (isDemoMode()) return { ok: true }
  const user = await currentUser()
  if (!user) return { ok: false, error: 'Your session expired. Please sign in again.' }
  const flow =
    user.role === 'contractor'
      ? 'professional'
      : user.role === 'facility' || user.role === 'staffing_agency'
        ? 'organization'
        : null
  if (!flow) return { ok: false, error: 'This step can’t be skipped.' }
  return recordProgress(await createClient(), user.id, flow, { skipped: [id] })
}
