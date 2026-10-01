// STUB (Admin agent) — the Lifecycle agent owns this file. Signatures match
// CONTRACT_V3; on merge keep the Lifecycle agent's implementation.
import type { SupabaseClient } from '@supabase/supabase-js'

export async function applyApproval(
  admin: SupabaseClient,
  contractorId: string
): Promise<{ status: 'approved' | 'insurance_pending'; insuranceDueAt: string | null }> {
  void admin
  void contractorId
  throw new Error('not implemented')
}

export async function markInsuranceVerified(
  admin: SupabaseClient,
  contractorId: string
): Promise<void> {
  void admin
  void contractorId
  throw new Error('not implemented')
}
