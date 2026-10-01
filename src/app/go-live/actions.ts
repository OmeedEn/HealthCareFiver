'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { currentUser } from '@/lib/auth/roles'
import { isDemoMode } from '@/lib/demo/data'
import { CONTRACTOR_AGREEMENT_VERSION } from '@/lib/legal'

export type AcceptAgreementState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string }

/**
 * Accept the Independent Contractor and Platform Agreement. The write goes
 * through the accept_contractor_agreement RPC (SECURITY DEFINER), which
 * stamps contractor_agreement_accepted_at / _version and itself rejects
 * callers who aren't approved contractors — the columns are protected from
 * direct self-update.
 */
export async function acceptContractorAgreement(
  _prev: AcceptAgreementState,
  formData: FormData
): Promise<AcceptAgreementState> {
  if (isDemoMode()) {
    return { status: 'success' }
  }

  // currentUser() enforces AAL2 (MFA).
  const user = await currentUser()
  if (!user || user.role !== 'contractor') {
    return {
      status: 'error',
      message: 'You must be signed in as a professional to accept the agreement.',
    }
  }

  if (formData.get('agree') !== 'on') {
    return {
      status: 'error',
      message: 'Please check the box to agree before continuing.',
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('accept_contractor_agreement', {
    p_version: CONTRACTOR_AGREEMENT_VERSION,
  })

  if (error) {
    console.error('[go-live] accept_contractor_agreement failed', error)
    return {
      status: 'error',
      message:
        error.code === '42501'
          ? 'Your credentials must be approved before you can accept the agreement.'
          : 'We couldn’t record your agreement. Please try again.',
    }
  }

  revalidatePath('/go-live')
  revalidatePath('/dashboard')
  return { status: 'success' }
}
