import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'

type AdminDb = ReturnType<typeof createAdminClient>

/** Applications waiting on an admin: professionals and submitted organizations. */
export async function countPendingVerification(db: AdminDb): Promise<{ pros: number; orgs: number }> {
  const [pros, orgs] = await Promise.all([
    db
      .from('contractor_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('verification_status', 'pending_review'),
    db
      .from('facility_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('verification_status', 'pending_review')
      .not('onboarding_submitted_at', 'is', null),
  ])
  return { pros: pros.count ?? 0, orgs: orgs.count ?? 0 }
}
