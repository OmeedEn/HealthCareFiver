import { redirect } from 'next/navigation'
import { isDemoMode } from '@/lib/demo/data'

// Legacy route. The paid "go live" plan was dropped: Sanus is free to join and
// a small service fee applies to each booking. Going live now happens at
// /go-live (contractor agreement + payouts). Kept so old links/emails work.
export default async function SubscribePage() {
  if (isDemoMode()) {
    redirect('/go-live')
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirectTo=/go-live')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = profile?.role ?? user.user_metadata?.role
  redirect(role === 'contractor' ? '/go-live' : '/dashboard')
}
