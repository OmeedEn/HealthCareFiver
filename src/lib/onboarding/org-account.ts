import 'server-only'
import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * "Continue with Google" creates every new account as a professional
 * (handle_new_user defaults the role). When someone started from
 * /signup/organization we turn that brand-new account into an organization.
 *
 * Only safe for an account that is clearly untouched: created in the last
 * 24 hours, never started the professional wizard, and has no credentials,
 * listings or applications. Anything else stays a professional.
 */
const MAX_AGE_MS = 24 * 60 * 60 * 1000

export async function canConvertToOrg(admin: SupabaseClient, user: User): Promise<boolean> {
  if (Date.now() - new Date(user.created_at).getTime() > MAX_AGE_MS) return false

  const [{ data: profile }, { data: contractor }, creds, offerings, apps] = await Promise.all([
    admin.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    admin
      .from('contractor_profiles')
      .select('professional_category, onboarding_completed_at')
      .eq('id', user.id)
      .maybeSingle(),
    admin.from('credentials').select('id', { count: 'exact', head: true }).eq('contractor_id', user.id),
    admin
      .from('professional_offerings')
      .select('id', { count: 'exact', head: true })
      .eq('contractor_id', user.id),
    admin.from('job_applications').select('id', { count: 'exact', head: true }).eq('contractor_id', user.id),
  ])

  return (
    profile?.role === 'contractor' &&
    !contractor?.professional_category &&
    !contractor?.onboarding_completed_at &&
    (creds.count ?? 0) === 0 &&
    (offerings.count ?? 0) === 0 &&
    (apps.count ?? 0) === 0
  )
}

/** Swap the professional rows for organization rows. Service-role client only. */
export async function convertToOrg(
  admin: SupabaseClient,
  userId: string,
  contactName: string
): Promise<void> {
  const { error: delError } = await admin.from('contractor_profiles').delete().eq('id', userId)
  if (delError) throw new Error(`Couldn't remove professional profile: ${delError.message}`)

  const { error: roleError } = await admin.from('profiles').update({ role: 'facility' }).eq('id', userId)
  if (roleError) throw new Error(`Couldn't change account type: ${roleError.message}`)

  const { error: insError } = await admin.from('facility_profiles').insert({
    id: userId,
    facility_name: '',
    facility_type: 'other',
    contact_name: contactName,
  })
  if (insError) throw new Error(`Couldn't create organization profile: ${insError.message}`)
}
