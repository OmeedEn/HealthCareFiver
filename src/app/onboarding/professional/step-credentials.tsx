'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeft, ArrowRight, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { US_STATES } from '@/lib/utils/constants'
import { saveCredentialDetails } from './actions'
import {
  CEU_OPTIONS,
  CONSULTANT_CLIENT_TYPES,
  CONSULTING_BACKGROUND_MAX,
  DISCLOSURE_DETAILS_MAX,
  DISCLOSURE_KEYS,
  DISCLOSURE_QUESTIONS,
  EDUCATOR_AUDIENCES,
  LICENSE_TYPE_SUGGESTIONS,
  PRACTICE_QUESTION,
  branchHasComplianceQuestions,
  todayIso,
  type Branch,
  type CredentialBasis,
  type CredentialsData,
  type DisclosureAnswer,
  type DisclosureKey,
  type ProCategory,
} from './shared'
import {
  ChipMultiSelect,
  PRIMARY_BTN,
  RadioCards,
  StepHeading,
  TextAreaField,
  TextField,
  FieldError,
  YES_NO_OPTIONS,
} from './ui'

const STATE_LABEL = new Map(US_STATES.map((s) => [s.value, s.label]))

export function StepCredentials({
  category,
  credentialBasis,
  branch,
  initial,
  onBack,
  onSaved,
}: {
  category: ProCategory
  credentialBasis: CredentialBasis | null
  /** effectiveBranch(category, credentialBasis) */
  branch: Branch
  initial: CredentialsData
  onBack: () => void
  onSaved: (c: CredentialsData) => void
}) {
  const [v, setV] = useState<CredentialsData>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  function set<K extends keyof CredentialsData>(key: K, value: CredentialsData[K]) {
    setV((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }))
  }

  function setDisclosure(key: DisclosureKey, patch: Partial<DisclosureAnswer>) {
    setV((prev) => ({
      ...prev,
      self_disclosures: {
        ...prev.self_disclosures,
        [key]: { ...prev.self_disclosures[key], ...patch },
      },
    }))
    setErrors((e) => {
      const next = { ...e }
      for (const f of Object.keys(patch)) delete next[`self_disclosures.${key}.${f}`]
      if (patch.answer === 'no') delete next[`self_disclosures.${key}.details`]
      return next
    })
  }

  const licenseExpired =
    !!v.license_expiration_date && v.license_expiration_date < todayIso()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      // category/credential_basis are only read in demo mode; otherwise the
      // server branches on the stored values.
      const res = await saveCredentialDetails({
        ...v,
        category,
        credential_basis: credentialBasis,
      })
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {})
        toast.error(res.error)
        return
      }
      setErrors({})
      onSaved(v)
    })
  }

  return (
    <form onSubmit={submit} noValidate>
      <StepHeading
        title="Your credentials"
        sub="This is what our team reviews before you can be booked."
      />

      <div className="mt-6 space-y-4">
        {branch === 'clinical' && (
          <>
            <TextField
              id="legal_name"
              label="Legal name as it appears on your license"
              value={v.legal_name}
              onChange={(x) => set('legal_name', x)}
              error={errors.legal_name}
              autoComplete="name"
              maxLength={150}
            />
            <TextField
              id="other_names"
              label="Other names used"
              optional
              value={v.other_names}
              onChange={(x) => set('other_names', x)}
              error={errors.other_names}
              placeholder="e.g., maiden name, former legal name"
              maxLength={300}
            />
            <TextField
              id="license_type"
              label="Profession / license type"
              value={v.license_type}
              onChange={(x) => set('license_type', x)}
              error={errors.license_type}
              placeholder="e.g., RN, NP, LCSW"
              list="license-type-suggestions"
            />
            <datalist id="license-type-suggestions">
              {LICENSE_TYPE_SUGGESTIONS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <TextField
              id="specialty"
              label="Specialty"
              value={v.specialty}
              onChange={(x) => set('specialty', x)}
              error={errors.specialty}
              placeholder="e.g., Family medicine, Pediatrics, Women's health"
            />
            <TextField
              id="state_license_number"
              label="License number"
              value={v.state_license_number}
              onChange={(x) => set('state_license_number', x)}
              error={errors.state_license_number}
              placeholder="As it appears on your license"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="license_issue_date"
                label="License issue date"
                type="date"
                value={v.license_issue_date}
                onChange={(x) => set('license_issue_date', x)}
                error={errors.license_issue_date}
              />
              <TextField
                id="license_expiration_date"
                label="License expiration date"
                type="date"
                value={v.license_expiration_date}
                onChange={(x) => set('license_expiration_date', x)}
                error={errors.license_expiration_date}
              />
            </div>
            {licenseExpired && !errors.license_expiration_date && (
              <p
                role="status"
                className="flex items-start gap-2 rounded-lg border border-[#f5d48a] bg-[#fff8e6] p-3 text-xs text-[#8a5a00]"
              >
                <AlertTriangle className="mt-px size-4 shrink-0" />
                This license appears to be expired. You can continue, but we can only
                approve an active license.
              </p>
            )}
            <StateMultiSelect
              id="license_states"
              label="Licensing state"
              value={v.license_states}
              onChange={(x) => set('license_states', x)}
              error={errors.license_states}
            />
            <RadioCards
              name="has_compact_license"
              legend="Do you hold a compact (multistate) license?"
              options={YES_NO_OPTIONS}
              columns={2}
              value={v.has_compact_license}
              onChange={(x) => set('has_compact_license', x)}
              error={errors.has_compact_license}
            />
            <StateMultiSelect
              id="telehealth_states"
              label="States where your clients will be"
              sub="(for telehealth; add all that apply)"
              value={v.telehealth_states}
              onChange={(x) => set('telehealth_states', x)}
              error={errors.telehealth_states}
            />
            <TextField
              id="npi_number"
              label="NPI number"
              optional
              value={v.npi_number}
              onChange={(x) => set('npi_number', x.replace(/\D/g, '').slice(0, 10))}
              error={errors.npi_number}
              inputMode="numeric"
              placeholder="10 digits"
            />
            <YearsField
              label="Years in practice"
              value={v.years_of_experience}
              onChange={(x) => set('years_of_experience', x)}
              error={errors.years_of_experience}
            />
          </>
        )}

        {branch === 'allied' && (
          <>
            <TextField
              id="legal_name"
              label="Name as it appears on your certification"
              value={v.legal_name}
              onChange={(x) => set('legal_name', x)}
              error={errors.legal_name}
              autoComplete="name"
              maxLength={150}
            />
            <TextField
              id="certification_type"
              label="Certification type"
              value={v.certification_type}
              onChange={(x) => set('certification_type', x)}
              error={errors.certification_type}
              placeholder="e.g., Certified Personal Trainer, Birth Doula"
            />
            <TextField
              id="certifying_organization"
              label="Certifying organization"
              value={v.certifying_organization}
              onChange={(x) => set('certifying_organization', x)}
              error={errors.certifying_organization}
              placeholder="e.g., NASM, DONA International, NCCAOM"
            />
            <TextField
              id="specialty"
              label="Specialty or focus"
              value={v.specialty}
              onChange={(x) => set('specialty', x)}
              error={errors.specialty}
              placeholder="e.g., Postpartum support, Strength training"
            />
            <YearsField
              label="Years of experience"
              value={v.years_of_experience}
              onChange={(x) => set('years_of_experience', x)}
              error={errors.years_of_experience}
            />
          </>
        )}

        {branch === 'consultant' && (
          <>
            <TextField
              id="specialty"
              label="Consulting specialty"
              value={v.specialty}
              onChange={(x) => set('specialty', x)}
              error={errors.specialty}
              placeholder="e.g., HIPAA compliance, Revenue cycle, Healthcare law"
            />
            <TextAreaField
              id="consulting_background"
              label="Short background"
              value={v.consulting_background}
              onChange={(x) => set('consulting_background', x.slice(0, CONSULTING_BACKGROUND_MAX))}
              error={errors.consulting_background}
              maxLength={CONSULTING_BACKGROUND_MAX}
              counter
              placeholder="A few sentences on your experience and who you've helped."
            />
            <ChipMultiSelect
              label="Who you usually work with"
              options={CONSULTANT_CLIENT_TYPES}
              value={v.client_types}
              onChange={(x) => set('client_types', x)}
              error={errors.client_types}
            />
            <YearsField
              label="Years of experience"
              value={v.years_of_experience}
              onChange={(x) => set('years_of_experience', x)}
              error={errors.years_of_experience}
            />
            <TextField
              id="website_url"
              label="LinkedIn or website link"
              optional
              type="url"
              inputMode="url"
              value={v.website_url}
              onChange={(x) => set('website_url', x)}
              error={errors.website_url}
              placeholder="linkedin.com/in/yourname"
            />
          </>
        )}

        {branch === 'educator' && (
          <>
            <TextField
              id="primary_background"
              label="Primary professional background"
              value={v.primary_background}
              onChange={(x) => set('primary_background', x)}
              error={errors.primary_background}
              placeholder="e.g., Critical care RN, Physical therapist, Nurse educator"
            />
            <TextAreaField
              id="teaching_topics"
              label="What you teach"
              value={v.teaching_topics}
              onChange={(x) => set('teaching_topics', x)}
              error={errors.teaching_topics}
              maxLength={500}
              placeholder="e.g., ACLS prep, wound care CEUs, lactation certification"
            />
            <ChipMultiSelect
              label="Who you teach"
              options={EDUCATOR_AUDIENCES}
              value={v.client_types}
              onChange={(x) => set('client_types', x)}
              error={errors.client_types}
            />
            <RadioCards
              name="ceu_accreditation"
              legend="Do you offer accredited CEU/CME credits?"
              options={CEU_OPTIONS}
              value={v.ceu_accreditation}
              onChange={(x) => set('ceu_accreditation', x)}
              error={errors.ceu_accreditation}
            />
          </>
        )}

        {branchHasComplianceQuestions(branch) && (
          <>
            <div className="border-t border-[#e4e5e7] pt-5">
              <RadioCards
                name="offers_high_risk_services"
                legend={PRACTICE_QUESTION}
                options={YES_NO_OPTIONS}
                columns={2}
                value={v.offers_high_risk_services}
                onChange={(x) => set('offers_high_risk_services', x)}
                error={errors.offers_high_risk_services}
              />
            </div>

            <div className="space-y-4 border-t border-[#e4e5e7] pt-5">
              <div>
                <h2 className="text-base font-bold text-[#404145]">Background questions</h2>
                <p className="mt-1 text-xs text-[#62646a]">
                  A &quot;yes&quot; doesn&apos;t automatically disqualify you. Please explain
                  any yes so our team has the full picture.
                </p>
              </div>
              {DISCLOSURE_KEYS.map((key) => {
                const d = v.self_disclosures[key]
                return (
                  <div key={key} className="space-y-2">
                    <RadioCards
                      name={`disclosure_${key}`}
                      legend={DISCLOSURE_QUESTIONS[key]}
                      options={YES_NO_OPTIONS}
                      columns={2}
                      value={d.answer}
                      onChange={(x) => setDisclosure(key, { answer: x })}
                      error={errors[`self_disclosures.${key}.answer`]}
                    />
                    {d.answer === 'yes' && (
                      <TextAreaField
                        id={`disclosure_${key}_details`}
                        label="Please explain"
                        value={d.details}
                        onChange={(x) => setDisclosure(key, { details: x })}
                        error={errors[`self_disclosures.${key}.details`]}
                        maxLength={DISCLOSURE_DETAILS_MAX}
                        placeholder="What happened, when, and how it was resolved."
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <div className="mt-8 flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="h-11 flex-1">
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>
        <Button type="submit" disabled={pending} className={`flex-1 ${PRIMARY_BTN}`}>
          {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Continue
          <ArrowRight className="ml-2 size-4" />
        </Button>
      </div>
    </form>
  )
}

function YearsField({
  label,
  value,
  onChange,
  error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
}) {
  return (
    <TextField
      id="years_of_experience"
      label={label}
      inputMode="numeric"
      value={value}
      onChange={(x) => onChange(x.replace(/\D/g, '').slice(0, 2))}
      error={error}
      placeholder="e.g., 8"
    />
  )
}

function StateMultiSelect({
  id,
  label,
  sub = '(add all that apply)',
  value,
  onChange,
  error,
}: {
  id: string
  label: string
  sub?: string
  value: string[]
  onChange: (v: string[]) => void
  error?: string
}) {
  const remaining = US_STATES.filter((s) => !value.includes(s.value))
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${id}_add`} className="text-sm font-semibold text-[#404145]">
        {label}
        <span className="ml-1 font-normal text-[#95979d]">{sub}</span>
      </Label>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-1">
          {value.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded-full border border-[#1dbf73] bg-[#e8faf1] py-1 pl-3 pr-1.5 text-xs font-medium text-[#0f8f56]"
            >
              {STATE_LABEL.get(s) ?? s}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== s))}
                aria-label={`Remove ${STATE_LABEL.get(s) ?? s}`}
                className="rounded-full p-0.5 hover:bg-[#bcebd5]"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <select
        id={`${id}_add`}
        value=""
        onChange={(e) => {
          if (e.target.value) onChange([...value, e.target.value])
        }}
        aria-invalid={error ? true : undefined}
        className="h-11 w-full rounded-lg border border-input bg-white px-2.5 text-sm text-[#404145] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
      >
        <option value="">{value.length ? 'Add another state…' : 'Select a state…'}</option>
        {remaining.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <FieldError msg={error} />
    </div>
  )
}
