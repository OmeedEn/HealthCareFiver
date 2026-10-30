import { redirect } from 'next/navigation'
import { isDemoMode, DEMO_CONTRACTOR } from '@/lib/demo/data'

/**
 * "My profile" is the public profile itself (/pros/[id]), shown to the owner
 * with a preview banner and an Edit link, so what a professional sees is
 * exactly what clients see. Edit at /contractor/profile/edit.
 */
export default async function ContractorProfilePage() {
  if (isDemoMode()) redirect(`/pros/${DEMO_CONTRACTOR.id}`)
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/contractor/profile')
  redirect(`/pros/${user.id}`)
}
