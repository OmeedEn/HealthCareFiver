'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { initPostHog, trackEvent } from '@/lib/analytics/posthog'
import { SIGNUP_EVENTS, type SignupPath } from '@/lib/onboarding/signup-path'

// Signup routing analytics (PostHog). Properties are fixed keys only, never
// anything the person typed (no PHI).

export type SignupScreen = 'signup' | 'offer' | 'looking'
export type SignupOption =
  | 'offer'
  | 'looking'
  | 'independent'
  | 'practice'
  | 'company'
  | 'unsure'
  | 'client'
  | 'hiring'
export type SignupFlow = 'professional' | 'organization' | 'client' | 'unsure'

/**
 * Child effects run before the root PostHogProvider's init effect, so make
 * sure PostHog is initialized before capturing (initPostHog is idempotent
 * and a no-op without a key). Init is synchronous, so the event isn't dropped.
 */
function capture(event: string, properties: Record<string, string | number>) {
  initPostHog()
  trackEvent(event, properties)
}

export function trackSignupScreenViewed(screen: SignupScreen) {
  capture(SIGNUP_EVENTS.screenViewed, { screen })
}

export function trackSignupOptionSelected(screen: SignupScreen, option: SignupOption) {
  capture(SIGNUP_EVENTS.optionSelected, { screen, option })
}

export function trackSignupStepViewed(flow: SignupFlow, step: number | string) {
  capture(SIGNUP_EVENTS.stepViewed, { flow, step })
}

export function trackSignupCompleted(signupPath: SignupPath) {
  capture(SIGNUP_EVENTS.completed, { signup_path: signupPath })
}

/* ───────── Per-question onboarding analytics (QuestionFlow `flowId`) ─────────
 * Question ids and durations only — never the answer itself. Drop-off is a
 * question that was viewed with no answered/skipped event after it. */

export function trackQuestionViewed(flow: string, question: string) {
  capture(SIGNUP_EVENTS.questionViewed, { flow, question })
}

export function trackQuestionAnswered(flow: string, question: string, ms: number) {
  capture(SIGNUP_EVENTS.questionAnswered, { flow, question, ms })
}

export function trackQuestionSkipped(flow: string, question: string, ms: number, kind?: 'upload') {
  capture(SIGNUP_EVENTS.questionSkipped, { flow, question, ms, ...(kind ? { kind } : {}) })
}

/** Fires signup_screen_viewed once on mount. Renders nothing. */
export function SignupScreenView({ screen }: { screen: SignupScreen }) {
  const sent = useRef(false)
  useEffect(() => {
    if (sent.current) return
    sent.current = true
    trackSignupScreenViewed(screen)
  }, [screen])
  return null
}

/** Fires signup_step_viewed whenever `step` changes. Renders nothing. */
export function useSignupStepViewed(flow: SignupFlow, step: number | string) {
  useEffect(() => {
    trackSignupStepViewed(flow, step)
  }, [flow, step])
}

/** A Link that records which signup option was picked before navigating. */
export function SignupOptionLink({
  screen,
  option,
  href,
  className,
  children,
}: {
  screen: SignupScreen
  option: SignupOption
  href: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Link href={href} className={className} onClick={() => trackSignupOptionSelected(screen, option)}>
      {children}
    </Link>
  )
}
