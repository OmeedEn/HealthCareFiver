import 'server-only'

import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isDemoMode, DEMO_CONTRACTOR } from '@/lib/demo/data'
import { getProviderState, type ProviderState } from '@/lib/listings/data'

export type ListingsContext = {
  userId: string
  /** null in demo mode */
  supabase: SupabaseClient | null
  state: ProviderState
}

const DEMO_STATE: ProviderState = {
  verificationStatus: 'approved',
  verificationNotes: null,
  agreementAcceptedAt: '2026-01-01T00:00:00.000Z',
  approvedAt: '2026-01-01T00:00:00.000Z',
  insuranceDueAt: null,
  insuredVerifiedAt: null,
  complianceHoldReason: null,
  isApproved: true,
  hasAgreement: true,
  isInsured: false,
  canGoLive: true,
}

/** Signed-in contractor + their go-live state, for /contractor/listings/**. */
export async function getListingsContext(): Promise<ListingsContext> {
  if (isDemoMode()) {
    return { userId: DEMO_CONTRACTOR.id, supabase: null, state: DEMO_STATE }
  }
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = (await createClient()) as unknown as SupabaseClient
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/contractor/listings')
  return {
    userId: user.id,
    supabase,
    state: await getProviderState(supabase, user.id),
  }
}
