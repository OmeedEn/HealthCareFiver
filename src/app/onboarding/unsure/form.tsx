'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TermsConsent } from '@/components/auth/signup-shared'
import { trackSignupCompleted } from '@/components/auth/signup-tracking'
import { CheckRow, TextField } from '@/app/onboarding/professional/ui'
import { QuestionFlow, SINGLE_STEP, type Screen } from '@/components/onboarding/question-flow'
import {
  EMPTY_UNSURE_DRAFT,
  UNSURE_DRAFT_KEY,
  unsureAnswersPayload,
  unsureQuestionScreens,
  unsureResumeIndex,
} from '@/components/onboarding/unsure-questions'
import { usePreAccountAnswers } from '@/lib/onboarding/pre-account'
import { UNSURE_QUESTIONS } from '@/lib/onboarding/questions/unsure'
import { UNSURE_REVIEW_CONSENT_LABEL, type UnsureAnswers } from '@/lib/onboarding/unsure'
import { isDemoMode } from '@/lib/demo/data'
import { finishUnsureAccount } from './actions'

/**
 * Google path of the Not sure signup. With the hand-off cookie's answers
 * this is a single screen (the consents Google skipped). Without them, the
 * four questions come first — resuming from this tab's stored answers when
 * they're still there.
 */
export function UnsureFinishFlow({
  answers,
  prefill,
  needsTerms,
  termsVersion,
}: {
  answers: UnsureAnswers | null
  prefill: { firstName: string; lastName: string }
  needsTerms: boolean
  termsVersion: string
}) {
  const router = useRouter()
  const [draft, setDraft, { hydrated, clear }] = usePreAccountAnswers(UNSURE_DRAFT_KEY, EMPTY_UNSURE_DRAFT)
  const needsName = !prefill.firstName || !prefill.lastName
  const [firstName, setFirstName] = useState(prefill.firstName)
  const [lastName, setLastName] = useState(prefill.lastName)
  const [accepted, setAccepted] = useState(false)
  const [reviewConsent, setReviewConsent] = useState(false)

  if (!answers && !hydrated) return null

  const canFinish =
    firstName.trim() !== '' && lastName.trim() !== '' && (!needsTerms || accepted) && reviewConsent

  const finishScreen: Screen = {
    id: UNSURE_QUESTIONS.account.id,
    title: 'Finish creating your account',
    continueLabel: 'Finish',
    canContinue: () => canFinish,
    save: async () => {
      if (isDemoMode()) return { ok: true }
      const result = await finishUnsureAccount({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        ...(needsTerms ? { accepted_terms: accepted, terms_version: termsVersion } : {}),
        review_consent: reviewConsent,
        answers: answers ?? unsureAnswersPayload(draft),
      })
      if (!result.ok) return result
      trackSignupCompleted('UNSURE')
      return { ok: true }
    },
    render: () => (
      <div className="space-y-4">
        {needsName && (
          <div className="grid grid-cols-2 gap-3">
            <TextField id="unsure-first" label="First name" value={firstName} onChange={setFirstName} autoComplete="given-name" maxLength={100} />
            <TextField id="unsure-last" label="Last name" value={lastName} onChange={setLastName} autoComplete="family-name" maxLength={100} />
          </div>
        )}
        <div className="space-y-3">
          {needsTerms && <TermsConsent checked={accepted} onChange={setAccepted} id="unsure-terms" />}
          <CheckRow
            id="unsure-review-consent"
            checked={reviewConsent}
            onChange={setReviewConsent}
            label={UNSURE_REVIEW_CONSENT_LABEL}
          />
        </div>
      </div>
    ),
  }

  const screens = answers ? [finishScreen] : [...unsureQuestionScreens(draft, setDraft), finishScreen]

  return (
    <QuestionFlow
      screens={screens}
      initialIndex={answers ? 0 : unsureResumeIndex(draft)}
      stepWeights={SINGLE_STEP}
      chrome="minimal"
      flowId="unsure"
      onFinish={() => {
        clear()
        router.push('/dashboard')
      }}
    />
  )
}
