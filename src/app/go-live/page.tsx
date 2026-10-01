import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileSignature,
  Landmark,
  Lock,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StripeConnectButton } from '@/components/payments/stripe-connect-button'
import { isDemoMode, DEMO_CONTRACTOR } from '@/lib/demo/data'
import {
  CONTRACTOR_AGREEMENT_PATH,
  CONTRACTOR_AGREEMENT_VERSION,
} from '@/lib/legal'
import { AgreementForm } from './agreement-form'

export const metadata: Metadata = {
  title: 'Go live — Sanus',
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

const FEE_LINE = 'Free to join. A small service fee applies to each booking.'

const AGREEMENT_SUMMARY = [
  'You’re an independent professional, not a Sanus employee — you set your prices and choose your bookings.',
  'You’re responsible for your license or certification, scope of practice, and insurance.',
  'Sanus charges a small service fee on each booking; you see the exact amount before you publish.',
  'Client payments and your payouts run through Stripe Connect.',
  'Protect client health information and follow HIPAA where it applies.',
]

type GoLiveData = {
  firstName: string
  verificationStatus: string | null
  agreementAcceptedAt: string | null
  agreementVersion: string | null
  hasConnectAccount: boolean
  payoutsOnboarded: boolean
  /** Set while Insurance pending: when the malpractice grace period ends. */
  insuranceDueAt: string | null
}

async function loadGoLiveData(payoutsReturn: boolean): Promise<GoLiveData> {
  if (isDemoMode()) {
    return {
      firstName: DEMO_CONTRACTOR.first_name,
      verificationStatus: 'approved',
      agreementAcceptedAt: null,
      agreementVersion: null,
      hasConnectAccount: false,
      payoutsOnboarded: false,
      insuranceDueAt: null,
    }
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirectTo=/go-live')
  }

  const [{ data: profile }, { data: contractor }] = await Promise.all([
    supabase
      .from('profiles')
      .select('role, stripe_connect_id, stripe_connect_onboarded')
      .eq('id', user.id)
      .maybeSingle(),
    // select('*') so this page keeps rendering if the agreement columns
    // haven't been migrated yet (they just read as undefined).
    supabase.from('contractor_profiles').select('*').eq('id', user.id).maybeSingle(),
  ])

  if (profile?.role !== 'contractor') {
    redirect('/dashboard')
  }

  const connectId = (profile?.stripe_connect_id as string | null) ?? null
  let payoutsOnboarded = profile?.stripe_connect_onboarded === true

  // Coming back from Stripe-hosted onboarding: the account.updated webhook
  // normally flips stripe_connect_onboarded, but it can lag (or be missing
  // in local dev), so check the account directly once.
  if (payoutsReturn && connectId && !payoutsOnboarded) {
    try {
      const { getAccountStatus } = await import('@/lib/stripe/connect')
      const status = await getAccountStatus(connectId)
      if (status.ready) {
        const { createAdminClient } = await import('@/lib/supabase/admin')
        // stripe_connect_onboarded is a protected billing column — service role only.
        const { error } = await createAdminClient()
          .from('profiles')
          .update({ stripe_connect_onboarded: true })
          .eq('id', user.id)
        if (error) {
          console.error('[go-live] Failed to persist Connect onboarding', error)
        } else {
          payoutsOnboarded = true
        }
      }
    } catch (err) {
      console.error('[go-live] Failed to check Stripe Connect status', err)
    }
  }

  return {
    firstName: (contractor?.first_name as string | null) ?? '',
    verificationStatus: (contractor?.verification_status as string | null) ?? null,
    agreementAcceptedAt:
      (contractor?.contractor_agreement_accepted_at as string | null | undefined) ?? null,
    agreementVersion:
      (contractor?.contractor_agreement_version as string | null | undefined) ?? null,
    hasConnectAccount: connectId !== null,
    payoutsOnboarded,
    insuranceDueAt:
      contractor?.verification_status === 'insurance_pending'
        ? ((contractor?.insurance_due_at as string | null | undefined) ?? null)
        : null,
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fafafa] px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-xl">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1dbf73] text-sm font-bold text-white">
            S
          </div>
          <span className="text-xl font-bold tracking-tight text-[#111827]">
            Sanus<span className="text-[#1dbf73]">.</span>
          </span>
        </Link>
        {children}
      </div>
    </div>
  )
}

function StepCard({
  id,
  step,
  title,
  done,
  icon: Icon,
  children,
}: {
  id?: string
  step: number
  title: string
  done: boolean
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-6 rounded-2xl border border-[#e4e5e7] bg-white p-6 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            done ? 'bg-[#1dbf73] text-white' : 'bg-[#e8faf1] text-[#1dbf73]'
          }`}
        >
          {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#95979d]">
            Step {step}
          </p>
          <h2 className="text-lg font-bold text-[#404145]">{title}</h2>
        </div>
        {done && (
          <span className="ml-auto rounded-full bg-[#e8faf1] px-2.5 py-1 text-xs font-bold text-[#0f8f56]">
            Done
          </span>
        )}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

const NOT_APPROVED_COPY: Record<string, { title: string; body: string }> = {
  more_info_requested: {
    title: 'We need a bit more information',
    body: 'Our review team asked for more information before approving your credentials. Upload what they need and we’ll pick your review back up.',
  },
  rejected: {
    title: 'Your application wasn’t approved',
    body: 'We weren’t able to approve your credentials. Check your email or dashboard for details from our review team.',
  },
  pending_review: {
    title: 'Your credentials are in review',
    body: 'We review every application within 24-48 hours. You’ll get an email when you’re approved — then come back here to finish going live.',
  },
}

const DEFAULT_NOT_APPROVED = {
  title: 'Finish your application first',
  body: 'Once your credentials are submitted and approved, you can accept the contractor agreement and set up payouts here.',
}

export default async function GoLivePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { payouts } = await searchParams
  const payoutsReturn = payouts === 'done'
  const data = await loadGoLiveData(payoutsReturn)

  // 'insurance_pending' providers are approved and live for listings that
  // don't need malpractice coverage.
  const isApproved =
    data.verificationStatus === 'approved' ||
    data.verificationStatus === 'insurance_pending'

  if (!isApproved) {
    const copy =
      (data.verificationStatus && NOT_APPROVED_COPY[data.verificationStatus]) ||
      DEFAULT_NOT_APPROVED
    return (
      <Shell>
        <div className="rounded-2xl border border-[#e4e5e7] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e8faf1]">
            <Clock className="h-7 w-7 text-[#1dbf73]" />
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-[#404145]">
            {copy.title}
          </h1>
          <p className="mt-2 text-sm text-[#62646a]">{copy.body}</p>
          <div className="mt-6 flex flex-col gap-3">
            {data.verificationStatus === 'more_info_requested' && (
              <Button
                className="h-11 w-full bg-[#1dbf73] text-sm font-bold text-white hover:bg-[#19a463]"
                render={<Link href="/contractor/credentials/upload" />}
              >
                Upload documents
              </Button>
            )}
            <Button
              variant="outline"
              className="h-11 w-full text-sm font-semibold"
              render={<Link href="/dashboard" />}
            >
              Go to dashboard
            </Button>
          </div>
        </div>
      </Shell>
    )
  }

  const agreementCurrent =
    data.agreementAcceptedAt !== null &&
    data.agreementVersion === CONTRACTOR_AGREEMENT_VERSION
  const agreementOutdated = data.agreementAcceptedAt !== null && !agreementCurrent
  const allDone = agreementCurrent && data.payoutsOnboarded

  return (
    <Shell>
      <div className="text-center">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-[#e8faf1] px-3 py-1 text-xs font-bold text-[#0f4c3a]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#1dbf73]" />
          Credentials approved
        </p>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-[#111827] sm:text-4xl">
          You&apos;re live on Sanus.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] text-[#62646a]">
          {data.firstName ? `Congratulations, ${data.firstName}. ` : 'Congratulations. '}
          {allDone
            ? 'You’re all set — clients can find and book you.'
            : 'Two quick steps to finish going live.'}
        </p>
      </div>

      <div className="mt-8 space-y-5">
        {data.verificationStatus === 'insurance_pending' && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-bold">
                Malpractice coverage due
                {data.insuranceDueAt ? ` by ${formatDate(data.insuranceDueAt)}` : ' within 30 days of approval'}
              </p>
              <p className="mt-1">
                The services you selected require malpractice coverage. Until
                our team reviews your certificate, in-person, home-visit,
                prescribing, injectable, and IV listings stay unpublished. You
                can publish consulting, telehealth, and educational listings
                now.
              </p>
              <Link
                href="/contractor/credentials/upload"
                className="mt-2 inline-block font-semibold text-amber-900 underline"
              >
                Upload your certificate
              </Link>
            </div>
          </div>
        )}

        {/* Step 1 — agreement */}
        <StepCard
          step={1}
          title="Accept the contractor agreement"
          icon={FileSignature}
          done={agreementCurrent}
        >
          {agreementCurrent ? (
            <p className="text-sm text-[#62646a]">
              You accepted the Independent Contractor and Platform Agreement
              {data.agreementAcceptedAt ? ` on ${formatDate(data.agreementAcceptedAt)}` : ''}
              .{' '}
              <Link
                href={CONTRACTOR_AGREEMENT_PATH}
                target="_blank"
                className="font-semibold text-[#0f8f56] hover:underline"
              >
                View agreement
              </Link>
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-[#404145]">
                You need to accept the agreement before your first listing can
                be published.
              </p>
              {agreementOutdated && (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  We&apos;ve updated the agreement since you last accepted it.
                  Please review and accept the current version.
                </p>
              )}
              <ul className="space-y-2">
                {AGREEMENT_SUMMARY.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-[#404145]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1dbf73]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={CONTRACTOR_AGREEMENT_PATH}
                target="_blank"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#0f8f56] hover:underline"
              >
                Read the full agreement
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
              <AgreementForm />
            </div>
          )}
        </StepCard>

        {/* Step 2 — payouts (Stripe Connect Express) */}
        <StepCard
          id="payouts"
          step={2}
          title="Set up payouts"
          icon={Landmark}
          done={data.payoutsOnboarded}
        >
          {data.payoutsOnboarded ? (
            <p className="text-sm text-[#62646a]">
              Your Stripe payout account is connected. Earnings from bookings
              are paid out to your bank through Stripe.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-[#404145]">
                Payouts run through Stripe Connect. You&apos;ll finish a short,
                secure setup on Stripe and come right back here.
              </p>
              <p className="flex items-start gap-2 rounded-lg bg-[#fafafa] p-3 text-sm text-[#62646a]">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#1dbf73]" />
                <span>
                  Bank info, date of birth, and SSN digits are collected and
                  handled by Stripe — Sanus never sees them.
                </span>
              </p>
              {payoutsReturn && data.hasConnectAccount && (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  Stripe is still finishing your setup, or needs a few more
                  details. If you left anything unfinished, continue below —
                  otherwise check back shortly.
                </p>
              )}
              <StripeConnectButton
                isOnboarded={false}
                returnTo="go-live"
                variant="button"
                label={data.hasConnectAccount ? 'Continue Stripe setup' : 'Set up payouts'}
                className="h-11 w-full bg-[#1dbf73] text-sm font-bold text-white hover:bg-[#19a463]"
              />
              <p className="text-xs text-[#95979d]">
                You need payouts set up to get paid for bookings.
              </p>
            </div>
          )}
        </StepCard>

        {allDone ? (
          <div className="rounded-2xl border border-[#bcebd5] bg-[#e8faf1] p-6 text-center">
            <h2 className="text-lg font-bold text-[#0f4c3a]">You&apos;re ready for bookings</h2>
            <p className="mt-1 text-sm text-[#0f8f56]">
              Publish your services, consulting, or events so clients can book you.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button
                className="h-11 flex-1 bg-[#1dbf73] text-sm font-bold text-white hover:bg-[#19a463]"
                render={<Link href="/contractor/profile" />}
              >
                Publish my offerings
              </Button>
              <Button
                variant="outline"
                className="h-11 flex-1 bg-white text-sm font-semibold"
                render={<Link href="/dashboard" />}
              >
                Go to dashboard
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-[#62646a] hover:underline"
            >
              I&apos;ll finish later — go to dashboard
            </Link>
          </div>
        )}

        <p className="text-center text-xs text-[#95979d]">{FEE_LINE}</p>
      </div>
    </Shell>
  )
}
