'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { OrgTermsConsent } from '@/components/org/org-terms-consent'
import { trackSignupCompleted } from '@/components/auth/signup-tracking'
import { QuestionFlow, SINGLE_STEP, type Screen } from '@/components/onboarding/question-flow'
import { nameScreen } from '@/components/onboarding/account-screens'
import { hasFullName, type NamePrefill } from '@/lib/onboarding/account-paths'
import { ORG_QUESTIONS } from '@/lib/onboarding/questions/organization'
import type { OrgSignupPath } from '@/lib/onboarding/signup-path'
import { isDemoMode } from '@/lib/demo/data'
import { finishOrgAccount } from './actions'

/**
 * The organization account screen, finished after "Continue with Google",
 * one question per screen: a name only if Google didn't share one, then the
 * one consent checkbox. Then straight on to the organization wizard.
 */
export function OrgAccountFlow({
  prefill,
  termsVersion,
  orgTermsVersion,
  source,
  fromPicker,
}: {
  prefill: NamePrefill
  termsVersion: string
  orgTermsVersion: string
  source: OrgSignupPath | null
  /** Came from the "What brings you to Sanus?" screen: the back arrow returns there. */
  fromPicker: boolean
}) {
  const router = useRouter()
  const [askName] = useState(() => !hasFullName(prefill))
  const [firstName, setFirstName] = useState(prefill.firstName)
  const [lastName, setLastName] = useState(prefill.lastName)
  const [accepted, setAccepted] = useState(false)

  const consentScreen: Screen = {
    id: ORG_QUESTIONS.account.id,
    title: 'Finish creating your account',
    sub: 'Free to join. Agree to our terms and you’re in.',
    continueLabel: 'Agree and continue',
    canContinue: () => accepted,
    save: async () => {
      if (isDemoMode()) return { ok: true }
      const res = await finishOrgAccount({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        accepted_terms: accepted,
        terms_version: termsVersion,
        org_terms_version: orgTermsVersion,
        source,
      })
      if (!res.ok) return res
      if (source) trackSignupCompleted(source)
      return { ok: true }
    },
    render: () => <OrgTermsConsent checked={accepted} onChange={setAccepted} />,
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
      flowId="organization_account"
      onExit={fromPicker ? () => router.push('/onboarding/professional') : undefined}
      onFinish={() => {
        router.replace('/onboarding/organization')
        router.refresh()
      }}
    />
  )
}
