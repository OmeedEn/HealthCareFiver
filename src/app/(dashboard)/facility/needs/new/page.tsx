import { redirect } from 'next/navigation'
import { isDemoMode } from '@/lib/demo/data'
import { STAFFING_POSTS_ENABLED } from '@/lib/onboarding/organization'
import { NewNeedForm } from './new-need-form'

/** Post an urgent need or staffing opportunity (spec step 5 D, after onboarding). */
export default async function NewUrgentNeedPage() {
  if (!STAFFING_POSTS_ENABLED || isDemoMode()) redirect('/dashboard')
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/facility/needs/new')
  const { data: org } = await supabase
    .from('facility_profiles')
    .select('city, state, zip_code')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#404145]">Post an urgent need or staffing opportunity</h1>
        <p className="text-sm text-[#62646a]">
          Saved as a draft. It publishes once your organization is approved.
        </p>
      </div>
      <NewNeedForm defaults={{ city: org?.city ?? '', state: org?.state ?? '', zip_code: org?.zip_code ?? '' }} />
    </div>
  )
}
