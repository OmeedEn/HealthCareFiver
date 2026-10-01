import { redirect } from 'next/navigation'
import { isDemoMode } from '@/lib/demo/data'
import { getGoLiveState } from '@/lib/auth/can-go-live'
import { SubscribeCard } from './subscribe-card'

// "Go live" checkout. Joining and verification are free; the $29/mo plan is
// only offered to approved professionals. Everyone else is routed away or
// told what to do first. The proxy has already enforced auth + MFA.
export default async function SubscribePage() {
  if (isDemoMode()) {
    return <SubscribeCard state="ready" />
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirectTo=/subscribe')
  }

  const state = await getGoLiveState(supabase, user.id)

  // Facilities, clients, admins: nothing to buy here.
  if (!state.isContractor) {
    redirect('/dashboard')
  }

  // Already live.
  if (state.isSubscribed) {
    redirect('/dashboard')
  }

  return <SubscribeCard state={state.isApproved ? 'ready' : 'not_verified'} />
}
