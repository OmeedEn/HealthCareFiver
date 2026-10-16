import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { CheckCircle2, Clock, Landmark, Lock, ShieldCheck } from 'lucide-react'
import { isDemoMode } from '@/lib/demo/data'
import { currentUser } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { isStripeConfigured } from '@/lib/stripe/connect'
import { StripeConnectButton } from '@/components/payments/stripe-connect-button'
import { StripeDashboardButton } from './dashboard-button'

export const metadata: Metadata = { title: 'Payouts — Sanus' }

type Props = { searchParams: Promise<{ onboarded?: string }> }

type State = 'not_approved' | 'stripe_off' | 'not_started' | 'in_progress' | 'ready'

/**
 * Organization payouts: connect a Stripe account so Sanus can send you the
 * money customers pay for your services and events (held until after each
 * booking, minus the Sanus fee). Stripe collects bank and identity details.
 */
export default async function OrgPayoutsPage({ searchParams }: Props) {
  await connection()
  let state: State = 'not_started'

  if (isDemoMode()) {
    state = 'not_started'
  } else {
    const user = await currentUser()
    if (!user) redirect('/login?redirectTo=/facility/payouts')
    const supabase = await createClient()
    const [{ data: profile }, { data: org }] = await Promise.all([
      supabase.from('profiles').select('stripe_connect_id, stripe_connect_onboarded').eq('id', user.id).single(),
      supabase.from('facility_profiles').select('verification_status').eq('id', user.id).maybeSingle(),
    ])
    const connectId = (profile?.stripe_connect_id as string | null) ?? null
    let ready = profile?.stripe_connect_onboarded === true

    // Back from Stripe onboarding: the account.updated webhook usually flips
    // stripe_connect_onboarded, but it can lag, so check once directly.
    const { onboarded } = await searchParams
    if (onboarded && connectId && !ready && isStripeConfigured()) {
      try {
        const { getAccountStatus } = await import('@/lib/stripe/connect')
        if ((await getAccountStatus(connectId)).ready) {
          const { createAdminClient } = await import('@/lib/supabase/admin')
          // Protected billing column: service role only.
          const { error } = await createAdminClient()
            .from('profiles')
            .update({ stripe_connect_onboarded: true })
            .eq('id', user.id)
          if (error) console.error('[facility/payouts] failed to save onboarding', error)
          else ready = true
        }
      } catch (err) {
        console.error('[facility/payouts] Stripe status check failed', err)
      }
    }

    state =
      org?.verification_status !== 'approved'
        ? 'not_approved'
        : ready
          ? 'ready'
          : !isStripeConfigured()
            ? 'stripe_off'
            : connectId
              ? 'in_progress'
              : 'not_started'
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#404145]">Payouts</h1>
        <p className="text-sm text-[#62646a]">
          Get paid for bookings of your services and events, straight to your bank account.
        </p>
      </div>

      <section className="rounded-2xl border border-[#e4e5e7] bg-white p-6">
        {state === 'ready' ? (
          <Status icon={CheckCircle2} tone="green" title="Payouts are ready" text="Paid bookings are sent to your bank account through Stripe after each booking takes place." />
        ) : state === 'in_progress' ? (
          <Status icon={Clock} tone="amber" title="Finish setting up payouts" text="Stripe still needs a few details before it can send you money." />
        ) : state === 'not_approved' ? (
          <Status icon={Lock} tone="gray" title="Available after approval" text="You can set up payouts once Sanus approves your organization." />
        ) : state === 'stripe_off' ? (
          <Status icon={Clock} tone="gray" title="Payouts are coming soon" text="We’re switching on payments. We’ll let you know when you can set up payouts." />
        ) : (
          <Status icon={Landmark} tone="green" title="Set up payouts" text="Connect your bank account through Stripe. It takes a few minutes." />
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {(state === 'not_started' || state === 'in_progress') && (
            <StripeConnectButton
              isOnboarded={false}
              returnTo="org-payouts"
              variant="button"
              label={state === 'in_progress' ? 'Continue setup' : 'Set up payouts'}
              className="h-11 bg-[#1dbf73] px-6 font-semibold text-white hover:bg-[#19a463]"
            />
          )}
          {state === 'ready' && <StripeDashboardButton />}
        </div>
      </section>

      <section className="rounded-2xl border border-[#e4e5e7] bg-white p-6 text-sm text-[#404145]">
        <h2 className="text-base font-semibold">How payment works</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[#62646a]">
          <li>A customer requests your service or event and you accept it (or they accept your quote).</li>
          <li>They pay on Sanus. We hold the payment until the booking takes place.</li>
          <li>After it happens, we send the payment to your bank through Stripe, minus the Sanus fee.</li>
        </ol>
        <p className="mt-4 flex items-start gap-2 text-xs text-[#62646a]">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#1dbf73]" aria-hidden="true" />
          Stripe collects your bank and identity details. Sanus never sees or stores them.
        </p>
        <p className="mt-3 text-xs text-[#62646a]">
          Paid services and events need payouts set up before they can be submitted for review.{' '}
          <Link href="/facility/listings" className="font-semibold text-[#1dbf73] hover:underline">Services &amp; events</Link>
        </p>
      </section>
    </div>
  )
}

const TONE = {
  green: 'bg-[#e8faf1] text-[#1dbf73]',
  amber: 'bg-[#fdf6e3] text-[#b08a0e]',
  gray: 'bg-[#f1f1f2] text-[#62646a]',
} as const

function Status({
  icon: Icon,
  tone,
  title,
  text,
}: {
  icon: React.ElementType
  tone: keyof typeof TONE
  title: string
  text: string
}) {
  return (
    <div className="flex items-start gap-4">
      <span className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${TONE[tone]}`}>
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div>
        <h2 className="text-lg font-semibold text-[#404145]">{title}</h2>
        <p className="mt-1 text-sm text-[#62646a]">{text}</p>
      </div>
    </div>
  )
}
