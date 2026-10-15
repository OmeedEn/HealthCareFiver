'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { QuestionFlow, type Screen } from '@/components/onboarding/question-flow'
import {
  firstOpenIdentityScreen,
  identityScreens,
} from '@/components/onboarding/professional/identity-screens'
import { DocumentUpload } from '@/components/onboarding/professional/document-upload'
import {
  DISCLOSURE_DETAILS_MAX,
  DISCLOSURE_OPTIONS,
  PRO_COPY,
  PRO_Q,
  PRO_SKIPPABLE,
  branchOf,
  postAccountScreenIds,
  type ProSignupAnswers,
} from '@/lib/onboarding/questions/professional'
import { branchHasComplianceQuestions } from '@/lib/onboarding/professional-branch'
import type { OnboardingProgress } from '@/lib/onboarding/progress'
import { CheckRow, TextAreaField } from './ui'
import { markScreen, saveDisclosures, saveIdentityAnswer, submitApplication } from './actions'
import { isUsableDoc, slotMatches, type DocSlotKey, type UploadedDoc } from './shared'

export interface InitialDisclosures {
  picked: string[]
  details: string
  /** "None of these apply" was chosen. */
  none: boolean
}

/** Screens 1–3 plus the account screen, for the share of the bar already behind them. */
const PRE_ACCOUNT_SCREENS = 4

export function ProfessionalOnboardingFlow({
  userId,
  includeIdentity,
  initialAnswers,
  initialDocs,
  initialDisclosures,
  progress,
}: {
  userId: string
  /** Ask screens 1–3 here (they weren't answered before the account). */
  includeIdentity: boolean
  initialAnswers: ProSignupAnswers
  initialDocs: UploadedDoc[]
  initialDisclosures: InitialDisclosures
  progress: Pick<OnboardingProgress, 'answered' | 'skipped'>
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState(initialAnswers)
  const [docs, setDocs] = useState(initialDocs)
  const [picked, setPicked] = useState(initialDisclosures.picked)
  const [none, setNone] = useState(initialDisclosures.none)
  const [details, setDetails] = useState(initialDisclosures.details)
  const [attest, setAttest] = useState(false)
  const [authorize, setAuthorize] = useState(false)

  const branch = branchOf(answers)
  const docFor = (slot: DocSlotKey) => {
    const types: string[] = branch ? slotMatches(slot, branch) : slot === 'government_id' ? ['government_id'] : ['license', 'certification', 'resume']
    return docs.find((d) => types.includes(d.credential_type) && isUsableDoc(d))
  }
  const onUploaded = (doc: UploadedDoc, replacedId: string | null) =>
    setDocs((prev) => [doc, ...prev.filter((d) => d.id !== replacedId)])

  const identity = includeIdentity
    ? identityScreens({
        answers,
        set: (patch) => setAnswers((a) => ({ ...a, ...patch })),
        persist: (id, a) => saveIdentityAnswer(id, a),
      })
    : []

  const credentialDoc = docFor('credential')
  const idDoc = docFor('government_id')
  const showDisclosures = !branch || branchHasComplianceQuestions(branch)
  const step = includeIdentity ? 1 : 2

  const post: Screen[] = [
    {
      id: PRO_Q.credentialUpload,
      step,
      title: branch ? PRO_COPY.upload[branch] : 'Upload a photo of your license, certification, or resume or CV',
      sub: PRO_COPY.uploadSub,
      skippable: PRO_SKIPPABLE.has(PRO_Q.credentialUpload),
      skipKind: 'upload',
      onSkip: () => markScreen(PRO_Q.credentialUpload, 'skipped'),
      canContinue: () => !!credentialDoc,
      render: () => (
        <DocumentUpload
          userId={userId}
          slot="credential"
          doc={credentialDoc}
          onUploaded={onUploaded}
          acceptsDocx={branch === 'consultant' || branch === 'educator'}
        />
      ),
    },
    {
      id: PRO_Q.governmentId,
      step,
      title: PRO_COPY.governmentId,
      whyWeAsk: PRO_COPY.governmentIdWhy,
      sub: 'A driver’s license, state ID, or passport.',
      skippable: PRO_SKIPPABLE.has(PRO_Q.governmentId),
      skipKind: 'upload',
      onSkip: () => markScreen(PRO_Q.governmentId, 'skipped'),
      canContinue: () => !!idDoc,
      render: () => <DocumentUpload userId={userId} slot="government_id" doc={idDoc} onUploaded={onUploaded} />,
    },
  ]

  if (showDisclosures) {
    post.push({
      id: PRO_Q.disclosures,
      step,
      title: PRO_COPY.disclosures,
      whyWeAsk: PRO_COPY.disclosuresWhy,
      fields: ['details'],
      canContinue: () => none || (picked.length > 0 && details.trim().length > 0),
      save: () => saveDisclosures({ picked: none ? [] : picked, details: none ? '' : details }),
      render: ({ errors }) => (
        <>
          <div role="group" aria-label={PRO_COPY.disclosures} className="grid gap-2.5">
            {DISCLOSURE_OPTIONS.map((o) => {
              const on = picked.includes(o.value)
              return (
                <Tile
                  key={o.value}
                  on={on}
                  label={o.label}
                  onClick={() => {
                    setNone(false)
                    setPicked(on ? picked.filter((x) => x !== o.value) : [...picked, o.value])
                  }}
                />
              )
            })}
            <Tile
              on={none}
              label={PRO_COPY.disclosuresNone}
              onClick={() => {
                setNone(!none)
                setPicked([])
              }}
            />
          </div>
          {picked.length > 0 && (
            <TextAreaField
              id="details"
              label={PRO_COPY.disclosuresMore}
              value={details}
              onChange={setDetails}
              maxLength={DISCLOSURE_DETAILS_MAX}
              rows={3}
              error={errors.details}
              placeholder="What happened, when, and how it was resolved."
            />
          )}
        </>
      ),
    })
  }

  post.push({
    id: PRO_Q.submit,
    step,
    title: PRO_COPY.submit,
    continueLabel: PRO_COPY.submitButton,
    canContinue: () => attest && authorize,
    save: () => submitApplication({ attest_accurate: attest, authorize_checks: authorize }),
    render: () => (
      <div className="space-y-4">
        <CheckRow id="attest_accurate" checked={attest} onChange={setAttest} label={PRO_COPY.attestAccurate} />
        <CheckRow id="authorize_checks" checked={authorize} onChange={setAuthorize} label={PRO_COPY.authorizeChecks} />
        <p className="text-xs text-[#62646a]">
          We review every application within 24-48 hours. Anything you skipped waits in your dashboard.
        </p>
      </div>
    ),
  })

  const screens = [...identity, ...post]

  // Resume: the first identity screen without a valid answer, else the first
  // post-account screen neither answered nor skipped (submit if all are).
  const [initialIndex] = useState(() => {
    const open = firstOpenIdentityScreen(identity)
    if (open < identity.length) return open
    const done = new Set([...progress.answered, ...progress.skipped])
    const ids = post.map((s) => s.id)
    const next = ids.findIndex((id) => !done.has(id))
    return identity.length + (next === -1 ? ids.length - 1 : next)
  })

  // Screens 1–3 and the account are behind them: give them their share of
  // the bar so it doesn't restart at zero after the account screen.
  const postCount = postAccountScreenIds(branch).length
  const stepWeights: Record<number, number> = includeIdentity
    ? { 1: 1 }
    : {
        1: PRE_ACCOUNT_SCREENS / (PRE_ACCOUNT_SCREENS + postCount),
        2: postCount / (PRE_ACCOUNT_SCREENS + postCount),
      }

  return (
    <QuestionFlow
      screens={screens}
      initialIndex={initialIndex}
      stepWeights={stepWeights}
      chrome="minimal"
      flowId="professional"
      onFinish={() => {
        // Straight to the dashboard: it shows the under-review banner and
        // the Finish your profile checklist.
        router.replace('/dashboard')
        router.refresh()
      }}
    />
  )
}

function Tile({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition outline-none focus-visible:ring-3 focus-visible:ring-[#1dbf73]/30 ${
        on
          ? 'border-[#1dbf73] bg-[#e8faf1] text-[#0f4c3a] shadow-[inset_0_0_0_1px_#1dbf73]'
          : 'border-[#e4e5e7] bg-white text-[#404145] hover:border-[#bcebd5]'
      }`}
    >
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded border ${
          on ? 'border-[#1dbf73] bg-[#1dbf73] text-white' : 'border-[#c5c6c9] bg-white'
        }`}
        aria-hidden
      >
        {on && <Check className="size-3.5" />}
      </span>
      {label}
    </button>
  )
}
