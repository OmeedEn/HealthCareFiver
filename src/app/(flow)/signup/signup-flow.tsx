'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Briefcase, Building2, CircleHelp, HandHeart, HeartHandshake, Search, Stethoscope } from 'lucide-react'
import { QuestionFlow, SINGLE_STEP, type Screen } from '@/components/onboarding/question-flow'
import { IconChoices } from '@/components/onboarding/choices'
import type { ChoiceIcons } from '@/components/onboarding/choice-icons'
import {
  SignupScreenView,
  trackSignupOptionSelected,
  type SignupOption,
} from '@/components/auth/signup-tracking'
import type { SignupPathFlow } from '@/components/auth/signup-account'
import type { OrgSignupPath } from '@/lib/onboarding/signup-path'
import { usePreAccountAnswers } from '@/lib/onboarding/pre-account'
import {
  DOOR_OF_CHOICE,
  type SignupChoice,
  type SignupDoorAnswer,
  type SignupStart,
} from '@/lib/onboarding/signup-start'
import { useProfessionalSignup } from './professional/flow'
import { useOrganizationSignup } from './organization/signup-flow'
import { useClientSignup } from './client/flow'
import { useUnsureSignup } from './unsure/flow'

// /signup as one continuous single-question flow (Signup Routing +
// Single-Question Onboarding specs): "What brings you to Sanus?", then the
// matching door, then that path's own questions and the account, all under
// one progress bar and without a page load. The two routing answers are kept
// in this tab's sessionStorage like every other pre-account answer. The old
// door URLs (/signup/offer, /signup/professional, …) redirect here with
// ?start=, which preselects the answer and opens the right screen.

type Door = SignupDoorAnswer
type Choice = SignupChoice

const ORG_SOURCE: Partial<Record<Choice, OrgSignupPath>> = {
  practice: 'PRACTICE',
  company: 'COMPANY',
  hiring: 'HIRING',
}

interface Route {
  door: Door | ''
  choice: Choice | ''
}

const EMPTY_ROUTE: Route = { door: '', choice: '' }

function routeFor(start: SignupStart): Route {
  return start === 'offer' || start === 'looking' ? { door: start, choice: '' } : { door: DOOR_OF_CHOICE[start], choice: start }
}

const DOOR_OPTIONS = [
  {
    value: 'offer',
    label: 'I offer services or expertise',
    sub: 'List your services, consulting, or events. For independent professionals, practices, and companies.',
  },
  {
    value: 'looking',
    label: "I'm looking for a professional",
    sub: 'Find and book experts, attend events, or hire for your organization.',
  },
]

const OFFER_OPTIONS = [
  {
    value: 'independent',
    label: 'Independent professional',
    sub: 'I work for myself. Solo practitioner, freelancer, consultant, coach, or educator offering my own services, consulting, or events.',
  },
  {
    value: 'practice',
    label: 'Practice, clinic, or facility',
    sub: 'We have a location and a team. Hospital, clinic, med spa, gym, wellness center, school, or nonprofit.',
  },
  {
    value: 'company',
    label: 'Company or firm',
    sub: "We sell expertise or training, but we're not a facility. Consulting, law, billing, or training firm, health tech vendor, or recruiting agency.",
  },
  {
    value: 'unsure',
    label: 'Not sure',
    sub: "Tell us a little about what you do and we'll place you in the right category.",
  },
]

const LOOKING_OPTIONS = [
  { value: 'client', label: 'Myself or my family', sub: 'Find care, coaching, or guidance, or attend an event.' },
  {
    value: 'hiring',
    label: 'My organization or business',
    sub: 'Hire or book professionals, post an urgent need, or find experts for your team.',
  },
]

const ICONS: ChoiceIcons = {
  offer: HandHeart,
  looking: Search,
  independent: Stethoscope,
  practice: Building2,
  company: Briefcase,
  unsure: CircleHelp,
  client: HeartHandshake,
  hiring: Building2,
}

/** Rough length of a path, so the bar doesn't read 50% on screen 1 before a path is picked. */
const UNKNOWN_PATH_WEIGHT = 8

export function SignupFlow({ start }: { start: SignupStart | null }) {
  // A ?start= deep link wins over answers stored in this tab.
  const [route, setRoute, { hydrated: routeHydrated }] = usePreAccountAnswers<Route>(
    'route',
    start ? routeFor(start) : EMPTY_ROUTE
  )
  const [startApplied, setStartApplied] = useState(!start)
  const [settled, setSettled] = useState(false)

  const pro = useProfessionalSignup()
  const org = useOrganizationSignup(ORG_SOURCE[route.choice as Choice] ?? 'PRACTICE')
  const client = useClientSignup()
  const unsure = useUnsureSignup()

  const path: SignupPathFlow | null =
    route.choice === 'independent'
      ? pro
      : route.choice === 'client'
        ? client
        : route.choice === 'unsure'
          ? unsure
          : route.choice
            ? org
            : null

  const allHydrated = routeHydrated && pro.hydrated && org.hydrated && client.hydrated && unsure.hydrated

  // Apply ?start= over whatever was stored, then drop it from the address bar
  // so a later refresh resumes from the stored answers instead.
  // Runs once, after sessionStorage has loaded (not available during render).
  useEffect(() => {
    if (!routeHydrated || startApplied || !start) return
    setRoute((prev) => {
      const r = routeFor(start)
      // Opening a door keeps a sub-choice already made behind it.
      return r.choice || prev.door !== r.door ? r : { door: r.door, choice: prev.choice }
    })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStartApplied(true)
    const url = new URL(window.location.href)
    url.searchParams.delete('start')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }, [routeHydrated, startApplied, start, setRoute])

  // One more commit after the route is final: the organization answers are
  // keyed by door and load in the same pass, so the resume screen is right.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (allHydrated && startApplied) setSettled(true)
  }, [allHydrated, startApplied])

  if (!settled) return <div className="min-h-[60vh]" aria-busy="true" />
  if (path?.done) return <>{path.done}</>

  const doorScreen: Screen = {
    id: 'door',
    title: 'What brings you to Sanus?',
    autoAdvance: true,
    canContinue: () => !!route.door,
    weight: 1,
    render: ({ advance }) => (
      <>
        <SignupScreenView screen="signup" />
        <IconChoices
          legend="What brings you to Sanus?"
          hideLegend
          options={DOOR_OPTIONS}
          icons={ICONS}
          value={route.door}
          onChange={(v) => {
            const door = v as Door
            trackSignupOptionSelected('signup', door)
            setRoute((prev) => (prev.door === door ? prev : { door, choice: '' }))
            advance()
          }}
          columns={1}
        />
        <p className="text-center text-sm text-[#62646a]">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-[#1dbf73] hover:underline">
            Sign in
          </Link>
        </p>
      </>
    ),
  }

  const offer = route.door !== 'looking'
  const choiceScreen: Screen = {
    id: offer ? 'door-offer' : 'door-looking',
    title: offer ? 'How do you work?' : 'Who is this for?',
    sub: offer ? 'Pick the one that fits best. This decides which questions we ask next.' : undefined,
    autoAdvance: true,
    canContinue: () => !!route.choice,
    weight: route.choice ? 1 : 1 + UNKNOWN_PATH_WEIGHT,
    render: ({ advance }) => (
      <>
        <SignupScreenView screen={offer ? 'offer' : 'looking'} />
        <IconChoices
          legend={offer ? 'How do you work?' : 'Who is this for?'}
          hideLegend
          options={offer ? OFFER_OPTIONS : LOOKING_OPTIONS}
          icons={ICONS}
          value={route.choice}
          onChange={(v) => {
            const choice = v as Choice
            trackSignupOptionSelected(offer ? 'offer' : 'looking', choice as SignupOption)
            setRoute((prev) => ({ ...prev, choice }))
            advance()
          }}
          columns={1}
        />
      </>
    ),
  }

  const routing = [doorScreen, choiceScreen]
  const screens = path ? [...routing, ...path.screens] : routing
  const initialIndex = path ? routing.length + path.resumeIndex : route.door ? 1 : 0

  return (
    <QuestionFlow
      screens={screens}
      initialIndex={initialIndex}
      stepWeights={SINGLE_STEP}
      chrome="minimal"
      // Per-question analytics under the path's own flow name, as before.
      flowId={path?.flowId}
      // The account screen's save already moved on (check email, onboarding,
      // matches or dashboard).
      onFinish={() => {}}
    />
  )
}
