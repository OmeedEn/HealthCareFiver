'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ATTEST_AUTHORIZED_LABEL, ATTEST_CHECKS_LABEL } from '@/lib/onboarding/organization'
import { ORG_QUESTIONS } from '@/lib/onboarding/questions/organization'
import type { OrgSignupPath } from '@/lib/onboarding/signup-path'
import { QuestionFlow, SINGLE_STEP, type Screen } from '@/components/onboarding/question-flow'
import { CheckRow } from '../professional/ui'
import { markOrgAnswered, saveOrgFields, skipOrgQuestion, submitOrgApplication } from './actions'
import { DocSlot } from './doc-slot'
import {
  licenseScreens,
  locationScreen,
  nameScreen,
  typeScreen,
  websiteScreen,
  type OrgAnswers,
} from './org-screens'
import type { OrgDoc, OrgFieldInput } from './shared'

/**
 * Organization onboarding after the account exists (Single-Question
 * Onboarding spec, screens 4–8). Staff-assigned accounts (Not sure →
 * Practice/Company) never saw screens 1–2, so those are asked here when the
 * answers aren't on file. Every screen saves as it's answered; a refresh
 * resumes on the first screen that's neither answered nor skipped.
 *
 * mode 'light' (Hiring organizations, verify later): only screens 1–2 if
 * missing and city/state, then the dashboard. mode 'full' is the whole flow;
 * for a Hiring organization it's the verification they're sent to from
 * posting or booking, with `intro` saying why and a way back to `next`.
 */
export function OrgOnboardingWizard({
  userId,
  door,
  initialAnswers,
  initialDocs,
  askType,
  askName,
  done,
  mode = 'full',
  intro = null,
  next = null,
}: {
  userId: string
  /** Signup door (profiles.signup_path); null legacy accounts arrive as HIRING. */
  door: OrgSignupPath
  initialAnswers: OrgAnswers
  initialDocs: OrgDoc[]
  /** Screens 1–2 still need an answer (staff-assigned accounts, lost Google answers). */
  askType: boolean
  askName: boolean
  /** Question ids already answered or skipped (onboarding_progress plus answers on file). */
  done: string[]
  /** 'light': Hiring orgs before the dashboard (type, name, city/state only). */
  mode?: 'light' | 'full'
  /** Why verification is being asked now (Hiring orgs sent here from posting or booking). */
  intro?: string | null
  /** Same-site path to return to when done (validated on the server). */
  next?: string | null
}) {
  const [v, setV] = useState(initialAnswers)
  const [docs, setDocs] = useState(initialDocs)
  const [attest, setAttest] = useState({ authorized: false, checks: false })
  const set = <K extends keyof OrgAnswers>(k: K, value: OrgAnswers[K]) => setV((d) => ({ ...d, [k]: value }))
  const save = (fields: Partial<OrgAnswers>, id: string) => saveOrgFields(fields as OrgFieldInput, [id])
  const ctx = { v, set, door, save }

  const reg = ORG_QUESTIONS.registration
  const registrationDocs = docs.filter((d) => d.kind === 'business_registration' || d.kind === 'facility_license')
  const registrationScreen: Screen = {
    id: reg.id,
    title: reg.text,
    sub: reg.sub,
    whyWeAsk: reg.whyWeAsk,
    fields: ['doc.business_registration'],
    skippable: true,
    skipKind: 'upload',
    onSkip: () => skipOrgQuestion(reg.id),
    canContinue: () => registrationDocs.length > 0,
    save: () => markOrgAnswered([reg.id]),
    render: ({ errors }) => (
      <DocSlot
        userId={userId}
        kind="business_registration"
        label="Registration document"
        docs={registrationDocs}
        onAdded={(doc) => setDocs((ds) => [...ds, doc])}
        onRemoved={(id) => setDocs((ds) => ds.filter((d) => d.id !== id))}
        error={errors['doc.business_registration']}
      />
    ),
  }

  const sq = ORG_QUESTIONS.submit
  const submitScreen: Screen = {
    id: sq.id,
    title: sq.text,
    fields: ['attest_authorized', 'attest_checks'],
    continueLabel: sq.continueLabel,
    canContinue: () => attest.authorized && attest.checks,
    save: async () => {
      const res = await submitOrgApplication({ attest_authorized: attest.authorized, attest_checks: attest.checks })
      if (res.ok) toast.success('Application submitted. We’ll email you within 24-48 hours.')
      return res
    },
    render: ({ errors }) => (
      <div className="space-y-4 rounded-xl border border-[#e4e5e7] bg-white p-5">
        <CheckRow
          id="attest_authorized"
          checked={attest.authorized}
          onChange={(x) => setAttest((a) => ({ ...a, authorized: x }))}
          label={ATTEST_AUTHORIZED_LABEL}
          error={errors.attest_authorized}
        />
        <CheckRow
          id="attest_checks"
          checked={attest.checks}
          onChange={(x) => setAttest((a) => ({ ...a, checks: x }))}
          label={ATTEST_CHECKS_LABEL}
          error={errors.attest_checks}
        />
      </div>
    ),
  }

  const screens: Screen[] =
    mode === 'light'
      ? [...(askType ? [typeScreen(ctx)] : []), ...(askName ? [nameScreen(ctx)] : []), locationScreen(ctx)]
      : [
          ...(askType ? [typeScreen(ctx)] : []),
          ...(askName ? [nameScreen(ctx)] : []),
          websiteScreen(ctx),
          locationScreen(ctx),
          ...licenseScreens(ctx),
          registrationScreen,
          submitScreen,
        ]

  // Resume once, from what the server loaded: the first screen that's
  // neither answered nor skipped.
  const [initialIndex] = useState(() => {
    const seen = new Set(done)
    const i = screens.findIndex((s) => !seen.has(s.id))
    return i === -1 ? screens.length - 1 : i
  })

  const flow = (
    <QuestionFlow
      screens={screens}
      initialIndex={initialIndex}
      stepWeights={SINGLE_STEP}
      chrome="minimal"
      flowId="organization"
      // Full load so the dashboard (and proxy) see the new state.
      onFinish={() => window.location.assign(next ?? '/dashboard')}
    />
  )
  if (!intro) return flow
  return (
    <>
      <div className="mb-6 flex flex-col gap-2 rounded-xl border border-[#bcebd5] bg-[#e8faf1] px-4 py-3 text-sm text-[#0f8f56] sm:flex-row sm:items-center sm:justify-between">
        <p>{intro}</p>
        <Link href={next ?? '/dashboard'} className="shrink-0 font-semibold underline-offset-4 hover:underline">
          Not now
        </Link>
      </div>
      {flow}
    </>
  )
}
