'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, Megaphone } from 'lucide-react'
import { QuestionFlow, SINGLE_STEP, type ActionResult, type Screen } from '@/components/onboarding/question-flow'
import { IconChoices } from '@/components/onboarding/choices'
import { startStripeConnect } from '@/components/payments/stripe-connect-button'
import { ORG_AGREEMENT_PATH } from '@/lib/legal'
import { eventScreens, serviceScreens } from '@/app/onboarding/organization/listing-questions'
import {
  localInputToIso,
  rowToEvent,
  rowToService,
  type ListingRow,
} from '@/app/onboarding/organization/listing-draft'
import { EMPTY_EVENT } from '@/app/onboarding/organization/sections/event-form'
import { EMPTY_SERVICE } from '@/app/onboarding/organization/sections/service-form'
import type { EventDraft, ServiceDraft } from '@/app/onboarding/organization/shared'
import { saveListingDraft } from '@/app/(dashboard)/facility/listings/actions'
import { acceptOrgAgreement, skipGoLiveScreen } from './actions'
import { AgreementBody, DoneRow, PayoutsBody } from './ui'
import type { GoLiveStep } from './pro-flow'

const AGREEMENT_SUMMARY = [
  'Sanus is a marketplace that connects you with professionals. It isn’t the employer or a staffing agency; you arrange pay, hiring, and compliance directly.',
  'Keep your organization’s information accurate. Sanus verifies it and runs exclusion screenings.',
  'Every listing, event, and post is reviewed before it goes live. Listings must be truthful.',
  'Paid services and events need payouts through Stripe Connect. A small service fee applies to each paid booking.',
  'Don’t post protected health information in listings, posts, or messages.',
]

const KIND_OPTIONS = [
  { value: 'service', label: 'A service', sub: 'Something individuals or businesses can book or ask about.' },
  { value: 'event', label: 'An event', sub: 'A webinar, workshop, CEU course, health fair, and more.' },
] as const
const KIND_ICONS = { service: Megaphone, event: CalendarDays }

export interface OrgGoLiveProps {
  orgName: string
  agreementAccepted: boolean
  showPayouts: boolean
  payoutsOnboarded: boolean
  hasConnectAccount: boolean
  payoutsReturned: boolean
  showListing: boolean
  resumeListing: ListingRow | null
  hasListing: boolean
  step: GoLiveStep | null
}

/**
 * The org listing questions (same screens and draft saves as Services &
 * events), behind a "service or event?" question that can be skipped.
 */
function useOrgListing(row: ListingRow | null) {
  const [kind, setKind] = useState<'service' | 'event' | null>(row?.kind ?? null)
  const [service, setService] = useState<ServiceDraft>(() => (row?.kind === 'service' ? rowToService(row) : EMPTY_SERVICE))
  const [event, setEvent] = useState<EventDraft>(() => (row?.kind === 'event' ? rowToEvent(row) : EMPTY_EVENT))
  const [listingId, setListingId] = useState<string | null>(row?.id ?? null)
  const [pending, setPending] = useState<string[]>([])
  const [skipped, setSkipped] = useState(false)

  const save = (keys: string[]) => async (): Promise<ActionResult> => {
    if (!kind) return { ok: false, error: 'Choose a service or an event.' }
    const value = kind === 'service' ? service : event
    const sendKeys = listingId ? keys : Array.from(new Set([...pending, ...keys]))
    const input = { ...value, ...('starts_at' in value ? { starts_at: localInputToIso(value.starts_at) } : {}) }
    const res = await saveListingDraft(kind, listingId, input, sendKeys)
    if (!res.ok) return res
    if (res.id) {
      setListingId(res.id)
      setPending([])
    } else {
      setPending(sendKeys)
    }
    return { ok: true }
  }

  const kindScreen: Screen = {
    id: 'listing_kind',
    step: 1,
    title: 'Add your first listing',
    sub: 'What do you want to list first? It saves as a draft as you go, and you submit it for review when it’s ready.',
    autoAdvance: true,
    canContinue: () => kind !== null,
    skippable: true,
    onSkip: async () => {
      const res = await skipGoLiveScreen('go_live_listing')
      if (res.ok) setSkipped(true)
      return res
    },
    render: ({ advance }) => (
      <IconChoices
        legend="Service or event"
        hideLegend
        options={KIND_OPTIONS}
        icons={KIND_ICONS}
        columns={1}
        value={kind ?? ''}
        onChange={(v) => {
          // A saved draft's kind is fixed.
          if (!listingId) setKind(v as 'service' | 'event')
          setSkipped(false)
          advance()
        }}
      />
    ),
  }

  if (!kind || skipped) return { screens: [kindScreen], listingId, firstOpen: () => 0 }

  const section = kind === 'service' ? 'New service' : 'New event'
  const built =
    kind === 'service'
      ? serviceScreens({
          value: service,
          set: (k, v) => setService((d) => ({ ...d, [k]: v })),
          section,
          saveFields: save,
          finish: () => save(['reach_via'])(),
          finishLabel: 'Save listing',
        })
      : eventScreens({
          value: event,
          set: (k, v) => setEvent((d) => ({ ...d, [k]: v })),
          section,
          saveFields: save,
          finish: () => save(['audiences', 'offers_ceu'])(),
          finishLabel: 'Save listing',
        })
  const screens: Screen[] = [kindScreen, ...built.map((s) => ({ ...s, step: 1 }))]
  const firstOpen = () => {
    const i = screens.findIndex((s) => Object.keys(s.validate?.() ?? {}).length > 0)
    return i === -1 ? screens.length - 1 : i
  }
  return { screens, listingId, firstOpen }
}

/**
 * Organization go-live, one screen at a time: Organization Agreement →
 * payouts (Stripe Connect, skippable; paid listings need it before review)
 * → first service or event (skippable) → done. Finished screens are left
 * out, so coming back resumes where they stopped.
 */
export function OrgGoLiveFlow(props: OrgGoLiveProps) {
  const router = useRouter()
  // Fixed on first render: accepting the agreement refreshes the page, and
  // the screen list must not shift under the flow.
  const [plan] = useState(props)
  const [agreed, setAgreed] = useState(false)
  const [payoutsSkipped, setPayoutsSkipped] = useState(false)
  const listing = useOrgListing(plan.resumeListing)

  const screens: Screen[] = []
  if (!plan.agreementAccepted) {
    screens.push({
      id: 'go_live_agreement',
      step: 1,
      title: 'Accept the Organization Agreement',
      sub: 'Needed before your first listing or post goes live.',
      canContinue: () => agreed,
      continueLabel: 'Accept and continue',
      save: () => acceptOrgAgreement(agreed),
      render: () => (
        <AgreementBody
          summary={AGREEMENT_SUMMARY}
          path={ORG_AGREEMENT_PATH}
          label="I agree to the Organization Agreement on behalf of my organization."
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
      sub: 'Get paid for bookings of your services and events, straight to your bank. A short, secure setup on Stripe, then you’re back here.',
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
          note="Not ready yet? Skip for now. Paid services and events need payouts set up before they can be submitted for review."
        />
      ),
    })
  }

  const listingStart = screens.length
  if (plan.showListing) screens.push(...listing.screens)

  const listingSaved = plan.hasListing || listing.listingId !== null
  const payoutsDone = plan.payoutsOnboarded

  screens.push({
    id: 'go_live_done',
    step: 1,
    title: payoutsDone && listingSaved ? 'You’re live on Sanus.' : 'You’re ready to go live.',
    sub: plan.orgName ? `${plan.orgName} is approved.` : 'Your organization is approved.',
    continueLabel: listingSaved ? 'Go to Services & events' : 'Go to your dashboard',
    render: () => (
      <>
        <ul className="divide-y divide-[#f1f1f2] rounded-xl border border-[#e4e5e7] px-4">
          <DoneRow done label="Organization Agreement accepted" />
          <DoneRow
            done={payoutsDone}
            label={payoutsDone ? 'Payouts connected' : 'Payouts'}
            detail={
              payoutsDone ? (
                'Paid bookings are sent to your bank through Stripe.'
              ) : (
                <>
                  {payoutsSkipped || !plan.showPayouts ? 'Not set up yet. ' : 'Stripe is finishing your setup. '}
                  <Link href="/facility/payouts" className="font-semibold text-[#1dbf73] hover:underline">
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
                'Submit it for review from Services & events. Our team reviews every listing before it goes live.'
              ) : (
                <Link href="/facility/listings" className="font-semibold text-[#1dbf73] hover:underline">
                  Add a service or event
                </Link>
              )
            }
          />
        </ul>
        {listingSaved && (
          <Link href="/dashboard" className="block text-center text-sm font-semibold text-[#62646a] hover:underline">
            Go to your dashboard
          </Link>
        )}
      </>
    ),
  })

  const [initialIndex] = useState(() => {
    if (!plan.agreementAccepted) return 0
    const at = (id: string) => screens.findIndex((s) => s.id === id)
    if (plan.step === 'payouts' && at('go_live_payouts') >= 0) return at('go_live_payouts')
    if (plan.step === 'listing' && plan.showListing) return listingStart + (plan.resumeListing ? listing.firstOpen() : 0)
    if (listingStart === 0 && plan.showListing && plan.resumeListing) return listing.firstOpen()
    return 0
  })

  return (
    <QuestionFlow
      screens={screens}
      initialIndex={initialIndex}
      stepWeights={SINGLE_STEP}
      chrome="minimal"
      flowId="org_go_live"
      onFinish={() => {
        router.push(listingSaved ? '/facility/listings' : '/dashboard')
        router.refresh()
      }}
    />
  )
}
