'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { US_STATES } from '@/lib/utils/constants'
import { saveCredentialDetails } from './actions'
import {
  CEU_OPTIONS,
  CONSULTANT_CLIENT_TYPES,
  CONSULTING_BACKGROUND_MAX,
  EDUCATOR_AUDIENCES,
  LICENSE_TYPE_SUGGESTIONS,
  type CredentialsData,
  type ProCategory,
} from './shared'
import {
  ChipMultiSelect,
  FieldError,
  PRIMARY_BTN,
  StepHeading,
  TextAreaField,
  TextField,
} from './ui'

const STATE_LABEL = new Map(US_STATES.map((s) => [s.value, s.label]))

export function StepCredentials({
  category,
  initial,
  onBack,
  onSaved,
}: {
  category: ProCategory
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

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await saveCredentialDetails({ ...v, category })
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
        {category === 'clinical' && (
          <>
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
            <StateMultiSelect
              value={v.license_states}
              onChange={(x) => set('license_states', x)}
              error={errors.license_states}
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

        {category === 'allied' && (
          <>
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
              id="certification_number"
              label="Certification number or ID"
              value={v.certification_number}
              onChange={(x) => set('certification_number', x)}
              error={errors.certification_number}
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

        {category === 'consultant' && (
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

        {category === 'educator' && (
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
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-[#404145]">
                Do you offer accredited CEU/CME credits?
              </legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {CEU_OPTIONS.map((o) => (
                  <label
                    key={o.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm transition ${
                      v.ceu_accreditation === o.value
                        ? 'border-[#1dbf73] bg-[#e8faf1] text-[#0f8f56]'
                        : 'border-[#e4e5e7] text-[#404145] hover:border-[#bcebd5]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="ceu_accreditation"
                      value={o.value}
                      checked={v.ceu_accreditation === o.value}
                      onChange={() => set('ceu_accreditation', o.value)}
                      className="accent-[#1dbf73]"
                    />
                    {o.label}
                  </label>
                ))}
              </div>
              <FieldError msg={errors.ceu_accreditation} />
            </fieldset>
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
  value,
  onChange,
  error,
}: {
  value: string[]
  onChange: (v: string[]) => void
  error?: string
}) {
  const remaining = US_STATES.filter((s) => !value.includes(s.value))
  return (
    <div className="space-y-1.5">
      <Label htmlFor="license_states_add" className="text-sm font-semibold text-[#404145]">
        Licensing state
        <span className="ml-1 font-normal text-[#95979d]">(add all that apply)</span>
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
        id="license_states_add"
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
