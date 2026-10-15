import { createClient } from '@/lib/supabase/server'
import { STAFFING_POSTS_ENABLED } from '@/lib/onboarding/organization'
import { getProgress } from '@/lib/onboarding/progress'
import { ORG_CHECKLIST_COLUMNS, buildOrgChecklist, type OrgChecklistRow } from '@/lib/onboarding/checklist-organization'
import { FinishProfileCard } from '@/components/onboarding/finish-profile-card'
import { DEFAULT_INTENTS, orgDoorFor } from '@/app/onboarding/organization/shared'
import { OrgFirstRunCards } from './org-first-run-cards'

/**
 * Organization dashboard, under the review banner: the Finish your profile
 * checklist and the "What do you want to do first?" cards. Loads its own
 * data so the dashboard page only renders it.
 */
export async function OrgFinishSection({ userId }: { userId: string }) {
  const supabase = await createClient()
  const [{ data: org }, { data: docs }, { data: profile }, progress, { count: listings }, { count: jobs }] =
    await Promise.all([
      supabase
        .rpc('my_facility_profile')
        .select(`${ORG_CHECKLIST_COLUMNS}, looking_for`)
        .maybeSingle<OrgChecklistRow & { looking_for: Record<string, unknown> | null }>(),
      supabase.from('org_documents').select('kind').eq('facility_id', userId),
      supabase.from('profiles').select('signup_path, avatar_url, stripe_connect_onboarded').eq('id', userId).single(),
      getProgress(supabase, userId, 'organization'),
      supabase.from('org_listings').select('id', { count: 'exact', head: true }).eq('facility_id', userId),
      supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('facility_id', userId),
    ])
  if (!org) return null
  const door = orgDoorFor(profile?.signup_path)

  const items = buildOrgChecklist({
    door,
    org,
    docKinds: (docs ?? []).map((d) => d.kind as string),
    answered: progress.answered,
    skipped: progress.skipped,
    hasLogo: !!profile?.avatar_url,
    payoutsOnboarded: profile?.stripe_connect_onboarded === true,
  })

  // First-run cards until they've started something.
  const lookingTypes = (org.looking_for as { types?: unknown } | null)?.types
  const started =
    (listings ?? 0) > 0 || (jobs ?? 0) > 0 || (Array.isArray(lookingTypes) && lookingTypes.length > 0)

  return (
    <>
      <FinishProfileCard items={items} />
      {!started && (
        <OrgFirstRunCards
          highlighted={DEFAULT_INTENTS[door]}
          hrefs={{
            advertise_services: '/facility/listings?new=service',
            host_events: '/facility/listings?new=event',
            find_professionals: '/facility/profile#looking-for',
            post_needs: STAFFING_POSTS_ENABLED ? '/facility/needs/new' : null,
          }}
        />
      )}
    </>
  )
}
