'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { effectiveBranch } from '@/lib/onboarding/professional-branch'
import { Progress } from './ui'
import { StepCategory } from './step-category'
import { StepCredentials } from './step-credentials'
import { StepDocuments } from './step-documents'
import { StepOfferings } from './step-offerings'
import {
  branchHasComplianceQuestions,
  type CredentialBasis,
  type CredentialsData,
  type InsuranceData,
  type OfferingDraft,
  type ProCategory,
  type UploadedDoc,
  type WizardStep,
} from './shared'

/**
 * Client shell for steps 2–5. Each step persists via a server action before
 * advancing (which also bumps contractor_profiles.onboarding_step), so the
 * server page can resume on refresh. Going Back is purely client-side.
 *
 * The application is submitted for review at the end of step 4; step 5
 * (offerings) then marks onboarding complete and sends the professional
 * straight to /dashboard, which shows the "under review" banner.
 */
export function OnboardingWizard({
  userId,
  initialStep,
  initialCategory,
  initialOtherProfession,
  initialCredentialBasis,
  initialCredentials,
  initialDocs,
  initialInsurance,
  initialOfferings,
}: {
  userId: string
  initialStep: WizardStep
  initialCategory: ProCategory | null
  initialOtherProfession: string
  initialCredentialBasis: CredentialBasis | null
  initialCredentials: CredentialsData
  initialDocs: UploadedDoc[]
  initialInsurance: InsuranceData
  initialOfferings: OfferingDraft[]
}) {
  const router = useRouter()
  const [step, setStep] = useState<WizardStep>(initialStep)
  const [category, setCategory] = useState<ProCategory | null>(initialCategory)
  const [otherProfession, setOtherProfession] = useState(initialOtherProfession)
  const [credentialBasis, setCredentialBasis] = useState<CredentialBasis | null>(
    initialCredentialBasis
  )
  const [credentials, setCredentials] = useState<CredentialsData>(initialCredentials)
  const [docs, setDocs] = useState<UploadedDoc[]>(initialDocs)
  const [insurance, setInsurance] = useState<InsuranceData>(initialInsurance)
  const topRef = useRef<HTMLDivElement>(null)

  const branch = category ? effectiveBranch(category, credentialBasis) : null

  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step])

  function finish() {
    // No waiting screen: the dashboard shows the "under review" banner.
    router.replace('/dashboard')
  }

  return (
    <div ref={topRef} className="scroll-mt-6 rounded-2xl border border-[#e4e5e7] bg-white p-6 sm:p-8">
      <Progress step={step} />
      <div className="mt-6">
        {step === 2 && (
          <StepCategory
            initial={category}
            initialOtherProfession={otherProfession}
            initialCredentialBasis={credentialBasis}
            onSaved={(c) => {
              setCategory(c.category)
              setOtherProfession(c.otherProfession)
              setCredentialBasis(c.credentialBasis)
              setStep(3)
            }}
          />
        )}
        {step === 3 && category && branch && (
          <StepCredentials
            // Remount when the branch changes so a stale form never shows.
            key={branch}
            category={category}
            credentialBasis={credentialBasis}
            branch={branch}
            initial={credentials}
            onBack={() => setStep(2)}
            onSaved={(c) => {
              setCredentials(c)
              setStep(4)
            }}
          />
        )}
        {step === 4 && branch && (
          <StepDocuments
            userId={userId}
            branch={branch}
            malpracticeRequired={
              branchHasComplianceQuestions(branch) &&
              credentials.offers_high_risk_services === 'yes'
            }
            docs={docs}
            setDocs={setDocs}
            insurance={insurance}
            setInsurance={setInsurance}
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
