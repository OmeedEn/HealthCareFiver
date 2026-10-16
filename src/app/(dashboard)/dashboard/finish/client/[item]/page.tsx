import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { isDemoMode } from '@/lib/demo/data'
import { createClient } from '@/lib/supabase/server'
import { formatUsPhone } from '@/lib/phone'
import { isClientFinishItem } from '@/lib/onboarding/checklist-client'
import { loadClientProfile } from '@/lib/onboarding/client-profile'
import { ClientFinishFlow } from './finish-flow'

export const metadata: Metadata = { title: 'Finish your profile — Sanus' }

/** A client's "Finish your profile" item, opened from the dashboard card. */
export default async function ClientFinishItemPage({ params }: { params: Promise<{ item: string }> }) {
  const { item } = await params
  if (!isClientFinishItem(item)) notFound()
  if (isDemoMode()) return <ClientFinishFlow item={item} initial="" email="you@example.com" />

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirectTo=/dashboard/finish/client/${item}`)

  const { data: profileRow } = await supabase
    .rpc('my_profile')
    .select('role, phone')
    .maybeSingle()
  if (profileRow?.role !== 'client') redirect('/dashboard')
  if (item === 'verify_email' && user.email_confirmed_at) redirect('/dashboard')

  const client = await loadClientProfile(supabase, user.id)
  if (!client) redirect('/dashboard')

  const initial =
    item === 'zip'
      ? client.zip_code
      : item === 'phone'
        ? profileRow.phone
          ? formatUsPhone(profileRow.phone as string)
          : ''
        : item === 'verify_email'
          ? ''
          : client[item]

  return (
    <div className="py-4 sm:py-8">
      <ClientFinishFlow item={item} initial={initial ?? ''} email={user.email ?? ''} />
    </div>
  )
}
