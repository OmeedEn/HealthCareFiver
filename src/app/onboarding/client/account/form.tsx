'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TermsConsent } from '@/components/auth/signup-shared'
import { trackSignupCompleted } from '@/components/auth/signup-tracking'
import { CheckRow } from '@/app/onboarding/professional/ui'
import { QuestionFlow, SINGLE_STEP, type Screen } from '@/components/onboarding/question-flow'
import { nameScreen } from '@/components/onboarding/account-screens'
import { hasFullName, type NamePrefill } from '@/lib/onboarding/account-paths'
import { isDemoMode } from '@/lib/demo/data'
import { finishClientAccount } from './actions'

/**
 * Client account step after "Continue with Google", one question per
 * screen: a name only if Google didn't share one, then one consent screen
 * (18+ and, when missing, Terms). Then straight on to their matches.
 */
export function ClientAccountFlow({
  prefill,
  needsTerms,
  termsVersion,
  fromPicker,
}: {
  prefill: NamePrefill
  needsTerms: boolean
  termsVersion: string
  /** Came from the "What brings you to Sanus?" screen: the back arrow returns there. */
  fromPicker: boolean
}) {
  const router = useRouter()
  const [askName] = useState(() => !hasFullName(prefill))
  const [firstName, setFirstName] = useState(prefill.firstName)
  const [lastName, setLastName] = useState(prefill.lastName)
  const [adult, setAdult] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const next = useRef('/dashboard')

  const consentScreen: Screen = {
    id: 'account',
    title: 'Finish creating your account',
    sub: 'Your answers stay private.',
    continueLabel: 'Agree and continue',
    canContinue: () => adult && (!needsTerms || accepted),
    save: async () => {
      if (isDemoMode()) return { ok: true }
      const res = await finishClientAccount({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        adult_attested: adult,
        ...(needsTerms ? { accepted_terms: accepted, terms_version: termsVersion } : {}),
      })
      if (!res.ok) return res
      next.current = res.next
      if (needsTerms) trackSignupCompleted('CLIENT')
      return { ok: true }
    },
    render: () => (
      <div className="space-y-4">
        <CheckRow id="adult_attested" checked={adult} onChange={setAdult} label="I'm 18 or older." />
        {needsTerms && <TermsConsent checked={accepted} onChange={setAccepted} id="client-accept-terms" />}
      </div>
    ),
  }

  const screens: Screen[] = [
    ...(askName
      ? [nameScreen({ first: firstName, last: lastName, setFirst: setFirstName, setLast: setLastName })]
      : []),
    consentScreen,
  ]

  return (
    <QuestionFlow
      screens={screens}
      initialIndex={0}
      stepWeights={SINGLE_STEP}
      chrome="minimal"
      flowId="client_account"
      onExit={fromPicker ? () => router.push('/onboarding/professional') : undefined}
      onFinish={() => {
        router.replace(next.current)
        router.refresh()
      }}
    />
  )
}
