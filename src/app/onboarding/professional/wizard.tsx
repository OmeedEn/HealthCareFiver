'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isDemoMode } from '@/lib/demo/data'
import { Progress } from './ui'
import { StepCategory } from './step-category'
import { StepCredentials } from './step-credentials'
import { StepDocuments } from './step-documents'
import { StepOfferings } from './step-offerings'
import type {
  CredentialsData,
  OfferingDraft,
  ProCategory,
  UploadedDoc,
  WizardStep,
} from './shared'

/**
 * Client shell for steps 2–5. Each step persists via a server action before
 * advancing (which also bumps contractor_profiles.onboarding_step), so the
 * server page can resume on refresh. Going Back is purely client-side.
 */
export function OnboardingWizard({
  userId,
  initialStep,
  initialCategory,
  initialCredentials,
  initialDocs,
  initialOfferings,
}: {
  userId: string
  initialStep: WizardStep
  initialCategory: ProCategory | null
  initialCredentials: CredentialsData
  initialDocs: UploadedDoc[]
  initialOfferings: OfferingDraft[]
}) {
  const router = useRouter()
  const [step, setStep] = useState<WizardStep>(initialStep)
  const [category, setCategory] = useState<ProCategory | null>(initialCategory)
  const [credentials, setCredentials] = useState<CredentialsData>(initialCredentials)
  const [docs, setDocs] = useState<UploadedDoc[]>(initialDocs)
  const topRef = useRef<HTMLDivElement>(null)

  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step])

  function finish() {
    if (isDemoMode()) {
      router.push('/onboarding/professional?step=done')
    } else {
      // The server page now sees onboarding_completed_at and renders the
      // pending screen.
      router.refresh()
    }
  }

  return (
    <div ref={topRef} className="scroll-mt-6 rounded-2xl border border-[#e4e5e7] bg-white p-6 sm:p-8">
      <Progress step={step} />
      <div className="mt-6">
        {step === 2 && (
          <StepCategory
            initial={category}
            onSaved={(c) => {
              setCategory(c)
              setStep(3)
            }}
          />
        )}
        {step === 3 && category && (
          <StepCredentials
            category={category}
            initial={credentials}
            onBack={() => setStep(2)}
            onSaved={(c) => {
              setCredentials(c)
              setStep(4)
            }}
          />
        )}
        {step === 4 && category && (
          <StepDocuments
            userId={userId}
            category={category}
            docs={docs}
            setDocs={setDocs}
            onBack={() => setStep(3)}
            onSaved={() => setStep(5)}
          />
        )}
        {step === 5 && (
          <StepOfferings
            initial={initialOfferings}
            onBack={() => setStep(4)}
            onDone={finish}
          />
        )}
      </div>
    </div>
  )
}
