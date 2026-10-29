'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { QuestionFlow, SINGLE_STEP, type Screen } from '@/components/onboarding/question-flow'
import { startStripeConnect } from '@/components/payments/stripe-connect-button'
import { useListingQuestions } from '@/components/listings/listing-questions'
import { CONTRACTOR_AGREEMENT_PATH } from '@/lib/legal'
import type { ListingRow } from '@/lib/listings/offering'
import { acceptContractorAgreement, skipGoLiveScreen } from './actions'
import { AgreementBody, DoneRow, PayoutsBody } from './ui'

const AGREEMENT_SUMMARY = [
  'You’re an independent professional, not a Sanus employee. You set your prices and choose your bookings.',
  'You’re responsible for your license or certification, scope of practice, and insurance.',
  'Sanus charges a small service fee on each booking. You see the exact amount before you publish.',
  'Client payments and your payouts run through Stripe Connect.',
  'Protect client health information and follow HIPAA where it applies.',
]

export type GoLiveStep = 'agreement' | 'payouts' | 'listing'

export interface ProGoLiveProps {
  firstName: string
  agreementCurrent: boolean
  agreementOutdated: boolean
  /** Payouts screen is shown (not onboarded, Stripe on, not skipped before unless asked for). */
  showPayouts: boolean
  payoutsOnboarded: boolean
  hasConnectAccount: boolean
  /** Back from Stripe (?payouts=done) but the account isn't ready yet. */
  payoutsReturned: boolean
  /** First-listing screens are shown (no finished listing, not skipped before unless asked for). */
  showListing: boolean
  /** An unfinished draft to continue in the listing questions. */
  resumeListing: ListingRow | null
  /** A finished draft that hasn't been submitted (done screen links to its review). */
  draftToSubmit: string | null
  hasListing: boolean
  insured: boolean
  /** Set while Insurance pending: when the malpractice grace period ends (formatted). */
  insuranceDue: string | null
  insurancePending: boolean
  step: GoLiveStep | null
}

/**
 * Professional go-live, one screen at a time: contractor agreement →
 * payouts (Stripe Connect, skippable: not a go-live gate) → first listing
 * (the listing questions, skippable) → done. Screens already finished are
 * left out, so coming back resumes where they stopped.
 */
export function ProGoLiveFlow(props: ProGoLiveProps) {
  const router = useRouter()
  // Fixed on first render: the agreement action refreshes the page, and the
  // screen list must not shift under the flow.
  const [plan] = useState(props)
  const [agreed, setAgreed] = useState(false)
  const [payoutsSkipped, setPayoutsSkipped] = useState(false)

  const listing = useListingQuestions({
    row: plan.resumeListing,
    insured: plan.insured,
    kindTitle: 'Create your first listing',
    kindSub: 'What do you want to offer first? It saves as a draft as you go, and you submit it for review when it’s ready.',
    skippable: true,
    onSkip: () => skipGoLiveScreen('go_live_listing'),
  })

  const screens: Screen[] = []

  if (!plan.agreementCurrent) {
    screens.push({
      id: 'go_live_agreement',
      step: 1,
      title: 'Accept the contractor agreement',
      sub: 'Needed before your first listing can be published.',
      canContinue: () => agreed,
      continueLabel: 'Accept and continue',
      save: () => acceptContractorAgreement(agreed),
      render: () => (
        <AgreementBody
          summary={AGREEMENT_SUMMARY}
          path={CONTRACTOR_AGREEMENT_PATH}
          outdated={plan.agreementOutdated}
          label="I agree to the Independent Contractor and Platform Agreement"
          agreed={agreed}
          onAgree={setAgreed}
        />
      ),
    })
  }

  if (plan.showPayouts) {
    screens.push({
      id: 'go_live_payouts',
      step: 1,
      title: 'Set up payouts',
      sub: 'Get paid for bookings, straight to your bank. You’ll finish a short, secure setup on Stripe and come right back here.',
      continueLabel: plan.hasConnectAccount ? 'Continue Stripe setup' : 'Set up payouts with Stripe',
      save: async () => ({ ok: false, error: await startStripeConnect('go-live') }),
      skippable: true,
      onSkip: async () => {
        const res = await skipGoLiveScreen('go_live_payouts')
        if (res.ok) setPayoutsSkipped(true)
        return res
      },
      render: () => (
        <PayoutsBody
          returnedUnfinished={plan.payoutsReturned}
          note="Not ready yet? Skip for now. You need payouts set up before your first paid booking."
        />
      ),
    })
  }

  const listingStart = screens.length
  if (plan.showListing) screens.push(...listing.screens)

  const listingId = listing.listingId ?? plan.draftToSubmit
  const listingSaved = plan.hasListing || listing.listingId !== null
  const payoutsDone = plan.payoutsOnboarded

  screens.push({
    id: 'go_live_done',
    step: 1,
    title: payoutsDone && listingSaved ? 'You’re live on Sanus.' : 'You’re ready to go live.',
    sub: plan.firstName ? `Congratulations, ${plan.firstName}.` : 'Congratulations.',
    continueLabel: listingId ? 'Review and submit your listing' : 'Go to your dashboard',
    render: () => (
      <>
        <ul className="divide-y divide-[#f1f1f2] rounded-xl border border-[#e4e5e7] px-4">
          <DoneRow done label="Contractor agreement accepted" />
          <DoneRow
            done={payoutsDone}
            label={payoutsDone ? 'Payouts connected' : 'Payouts'}
            detail={
              payoutsDone ? (
                'Earnings from bookings are paid to your bank through Stripe.'
              ) : (
                <>
                  {payoutsSkipped || !plan.showPayouts ? 'Not set up yet. ' : 'Stripe is finishing your setup. '}
                  <Link href="/go-live?step=payouts" className="font-semibold text-[#1dbf73] hover:underline">
                    Set up payouts
                  </Link>
                </>
              )
            }
          />
          <DoneRow
            done={listingSaved}
            label={listingSaved ? 'First listing saved' : 'Your first listing'}
            detail={
              listingSaved ? (
                'Submit it for review. Our team reviews every listing before it goes live.'
              ) : (
                <Link href="/contractor/listings/new" className="font-semibold text-[#1dbf73] hover:underline">
                  Create a listing
                </Link>
              )
            }
          />
        </ul>
        {plan.insurancePending && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-bold">
                Malpractice coverage due{plan.insuranceDue ? ` by ${plan.insuranceDue}` : ' within 30 days of approval'}
              </p>
              <p className="mt-1">
                Until our team reviews your certificate, in-person, home-visit, prescribing, injectable, and IV listings
                stay unpublished. Consulting, telehealth, and educational listings can publish now.
              </p>
              <Link href="/contractor/credentials/upload" className="mt-2 inline-block font-semibold underline">
                Upload your certificate
              </Link>
            </div>
          </div>
        )}
        {listingId && (
          <Link href="/dashboard" className="block text-center text-sm font-semibold text-[#62646a] hover:underline">
            Go to your dashboard
          </Link>
        )}
      </>
    ),
  })

  const [initialIndex] = useState(() => {
    const at = (id: string) => screens.findIndex((s) => s.id === id)
    // The agreement can't be skipped: it always comes first while it's open.
    if (!plan.agreementCurrent) return 0
    if (plan.step === 'payouts' && at('go_live_payouts') >= 0) return at('go_live_payouts')
    if (plan.step === 'listing' && plan.showListing) return listingStart + (plan.resumeListing ? listing.firstOpen() : 0)
    // Resume: everything shown is unfinished, so start at the top — or
    // inside an unfinished draft when the listing questions come first.
    if (listingStart === 0 && plan.showListing && plan.resumeListing) return listing.firstOpen()
    return 0
  })

  return (
    <QuestionFlow
      screens={screens}
      initialIndex={initialIndex}
      stepWeights={SINGLE_STEP}
      chrome="minimal"
      flowId="go_live"
      onFinish={() => {
        router.push(listingId ? `/contractor/listings/${listingId}/review` : '/dashboard')
        router.refresh()
      }}
    />
  )
}
