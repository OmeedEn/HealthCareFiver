'use client'

import { useState } from 'react'
import { ORG_TOTAL_STEPS, type OrgIntent, type OrgWizardStep } from '@/lib/onboarding/organization'
import { StepAbout } from './step-about'
import { StepVerify } from './step-verify'
import { StepIntents } from './step-intents'
import { StepQuickSetup } from './step-quick-setup'
import type { AboutData, OrgDoc, VerifyData } from './shared'

/**
 * Client shell for organization onboarding steps 2–5 (step 1 is
 * /signup/organization). Each step saves before advancing, which also bumps
 * facility_profiles.onboarding_step, so a refresh resumes where they left
 * off. Submitting step 5 sends them to /dashboard with the review banner.
 */
export function OrgOnboardingWizard({
  userId,
  initialStep,
  initialAbout,
  initialVerify,
  initialDocs,
  initialIntents,
}: {
  userId: string
  initialStep: OrgWizardStep
  initialAbout: AboutData
  initialVerify: VerifyData
  initialDocs: OrgDoc[]
  initialIntents: OrgIntent[]
}) {
  const [step, setStep] = useState<OrgWizardStep>(initialStep)
  const [about, setAbout] = useState(initialAbout)
  const [verify, setVerify] = useState(initialVerify)
  const [docs, setDocs] = useState(initialDocs)
  const [intents, setIntents] = useState(initialIntents)

  function go(next: OrgWizardStep) {
    setStep(next)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="space-y-8">
      <Progress step={step} />
      {step === 2 && <StepAbout value={about} onChange={setAbout} onDone={() => go(3)} />}
      {step === 3 && (
        <StepVerify
          userId={userId}
          value={verify}
          onChange={setVerify}
          docs={docs}
          onDocsChange={setDocs}
          onBack={() => go(2)}
          onDone={() => go(4)}
        />
      )}
      {step === 4 && (
        <StepIntents
          value={intents}
          onChange={setIntents}
          onBack={() => go(3)}
          onDone={() => go(5)}
        />
      )}
      {step === 5 && (
        <StepQuickSetup
          intents={intents}
          location={{ city: about.city, state: about.state, zip_code: about.zip_code }}
          onBack={() => go(4)}
          // Full load so the dashboard (and proxy) see the submitted state.
          onDone={() => window.location.assign('/dashboard')}
        />
      )}
    </div>
  )
}

function Progress({ step }: { step: number }) {
  const pct = (step / ORG_TOTAL_STEPS) * 100
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-medium text-[#62646a]">
        <span>
          Step {step} of {ORG_TOTAL_STEPS}
        </span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e4e5e7]"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={ORG_TOTAL_STEPS}
        aria-valuenow={step}
        aria-label={`Step ${step} of ${ORG_TOTAL_STEPS}`}
      >
        <div className="h-full rounded-full bg-[#1dbf73] transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
