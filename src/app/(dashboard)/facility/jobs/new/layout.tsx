import { redirect } from 'next/navigation'
import { STAFFING_POSTS_ENABLED } from '@/lib/onboarding/organization'
import { isDemoMode } from '@/lib/demo/data'
import { orgVerifyHref } from '@/lib/onboarding/org-verify-later'

// Job posting has the same legal exposure as spec staffing posts, so it stays
// off until NEXT_PUBLIC_STAFFING_POSTS_ENABLED is turned on.
export default async function NewJobLayout({ children }: { children: React.ReactNode }) {
  if (!STAFFING_POSTS_ENABLED) redirect('/facility/jobs')
  if (!isDemoMode()) {
    // Hiring orgs verify later: posting is the moment we ask.
    const { createClient } = await import('@/lib/supabase/server')
    const { orgMustVerify } = await import('@/lib/onboarding/org-verify-later-server')
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user && (await orgMustVerify(supabase, user.id))) redirect(orgVerifyHref('post', '/facility/jobs/new'))
  }
  return children
}
