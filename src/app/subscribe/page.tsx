import { redirect } from 'next/navigation'
import { SUBSCRIPTION_REQUIRED } from '@/lib/billing'
import { SubscribePaywall } from './subscribe-paywall'

export default function SubscribePage() {
  if (!SUBSCRIPTION_REQUIRED) redirect('/dashboard')
  return <SubscribePaywall />
}
