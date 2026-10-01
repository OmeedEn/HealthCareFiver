'use client'

import { useState } from 'react'
import { Info, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { US_STATES } from '@/lib/utils/constants'
import {
  MAX_SCREENING_QUESTIONS,
  NOT_EMPLOYER_NOTICE,
  PAY_UNITS,
  PROFESSIONAL_TIERS,
  STAFFING_ENGAGEMENTS,
  STAFFING_POST_TYPES,
} from '@/lib/onboarding/organization'
import { FieldError, RadioCards, SelectField, TextAreaField, TextField, Toggle } from '../../professional/ui'
import { saveStaffingPost } from '../actions'
import type { StaffingDraft } from '../shared'
import { SectionActions } from './fields'

export function emptyStaffing(defaults: { city?: string; state?: string; zip_code?: string } = {}): StaffingDraft {
  return {
    title: '', post_type: '', needs: [{ type: '', count: '1' }], is_ongoing: false, start_date: '',
    end_date: '', schedule: '', city: defaults.city ?? '', state: defaults.state ?? '',
    zip_code: defaults.zip_code ?? '', is_remote: false, engagement_type: '', is_volunteer: false,
    pay_min: '', pay_max: '', pay_unit: 'hourly', requirements: '', min_years: '', description: '',
    screening_questions: [], application_deadline: '', is_urgent: false, reviewer_emails: '', applicant_cap: '',
  }
}

/** D. Urgent need or staffing opportunity (saved as a draft post). */
export function StaffingForm({
  defaults,
  onSaved,
  onSkip,
}: {
  defaults?: { city?: string; state?: string; zip_code?: string }
  onSaved: () => void
  onSkip?: () => void
}) {
  const [v, setV] = useState<StaffingDraft>(() => emptyStaffing(defaults))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof StaffingDraft>(k: K, x: StaffingDraft[K]) => setV({ ...v, [k]: x })

  async function save() {
    setSaving(true)
    const res = await saveStaffingPost(v)
    setSaving(false)
    if (!res.ok) {
      setErrors(res.fields ?? {})
      toast.error(res.error)
      return
    }
    toast.success('Post saved as a draft')
    setErrors({})
    setV(emptyStaffing(defaults))
    onSaved()
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 rounded-lg border border-[#bcebd5] bg-[#e8faf1] p-3 text-xs text-[#0f8f56]">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>{NOT_EMPLOYER_NOTICE}</p>
      </div>

      <TextField id="sp-title" label="Title" placeholder="e.g. Flu clinic surge: 6 RNs needed" value={v.title} onChange={(x) => set('title', x)} error={errors.title} />
      <SelectField id="sp-type" label="Type" value={v.post_type} onChange={(x) => set('post_type', x)} options={STAFFING_POST_TYPES} error={errors.post_type} />

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-[#404145]">Professionals needed</legend>
        {v.needs.map((n, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <SelectField
                id={`sp-need-${i}`}
                label={i === 0 ? 'Type' : ' '}
                value={n.type}
                onChange={(x) => set('needs', v.needs.map((m, j) => (j === i ? { ...m, type: x } : m)))}
                options={PROFESSIONAL_TIERS}
                error={errors[`needs.${i}.type`]}
              />
            </div>
            <div className="w-24">
              <TextField
                id={`sp-count-${i}`}
                label={i === 0 ? 'How many' : ' '}
                value={n.count}
                onChange={(x) => set('needs', v.needs.map((m, j) => (j === i ? { ...m, count: x.replace(/\D/g, '') } : m)))}
                error={errors[`needs.${i}.count`]}
                inputMode="numeric"
              />
            </div>
            {v.needs.length > 1 && (
              <button type="button" onClick={() => set('needs', v.needs.filter((_, j) => j !== i))} className="mb-3 text-[#95979d] hover:text-red-600" aria-label="Remove">
                <X className="size-4" />
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => set('needs', [...v.needs, { type: '', count: '1' }])} className="inline-flex items-center gap-1 text-sm font-semibold text-[#1dbf73]">
          <Plus className="size-4" /> Add another type
        </button>
        <FieldError msg={errors.needs} />
      </fieldset>

      <div className="space-y-2">
        <Toggle id="sp-ongoing" checked={v.is_ongoing} onChange={(x) => set('is_ongoing', x)} label="Ongoing (no fixed dates)" />
        {!v.is_ongoing && (
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField id="sp-start" label="Start date" type="date" value={v.start_date} onChange={(x) => set('start_date', x)} error={errors.start_date} />
            <TextField id="sp-end" label="End date" optional type="date" value={v.end_date} onChange={(x) => set('end_date', x)} />
          </div>
        )}
      </div>
      <TextField id="sp-schedule" label="Schedule" placeholder="e.g. Weekdays 8am–4pm, 3 shifts/week" value={v.schedule} onChange={(x) => set('schedule', x)} error={errors.schedule} />

      <div className="grid gap-3 sm:grid-cols-[1fr_140px_140px]">
        <TextField id="sp-city" label="City" value={v.city} onChange={(x) => set('city', x)} error={errors.city} />
        <SelectField id="sp-state" label="State" value={v.state} onChange={(x) => set('state', x)} options={US_STATES} error={errors.state} />
        <TextField id="sp-zip" label="ZIP" value={v.zip_code} onChange={(x) => set('zip_code', x)} error={errors.zip_code} inputMode="numeric" />
      </div>
      <Toggle id="sp-remote" checked={v.is_remote} onChange={(x) => set('is_remote', x)} label="Remote" />

      <RadioCards name="sp-engagement" legend="Engagement type" options={STAFFING_ENGAGEMENTS} value={v.engagement_type as never} onChange={(x) => set('engagement_type', x)} error={errors.engagement_type} />

      <div className="space-y-2">
        <Toggle id="sp-volunteer" checked={v.is_volunteer} onChange={(x) => set('is_volunteer', x)} label="This is a volunteer opportunity (unpaid)" />
        {!v.is_volunteer && (
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr]">
            <TextField id="sp-pay-min" label="Pay ($)" value={v.pay_min} onChange={(x) => set('pay_min', x)} error={errors.pay_min} inputMode="decimal" />
            <TextField id="sp-pay-max" label="Up to ($)" optional value={v.pay_max} onChange={(x) => set('pay_max', x)} error={errors.pay_max} inputMode="decimal" />
            <SelectField id="sp-pay-unit" label="Unit" value={v.pay_unit} onChange={(x) => set('pay_unit', x)} options={PAY_UNITS} error={errors.pay_unit} />
          </div>
        )}
      </div>

      <TextAreaField id="sp-req" label="Requirements" optional placeholder="License, certifications like BLS or ACLS…" value={v.requirements} onChange={(x) => set('requirements', x)} />
      <div className="max-w-[220px]">
        <TextField id="sp-years" label="Minimum years of experience" optional value={v.min_years} onChange={(x) => set('min_years', x.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" />
      </div>
      <TextAreaField id="sp-desc" label="Description" value={v.description} onChange={(x) => set('description', x)} error={errors.description} rows={4} />

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-[#404145]">
          Screening questions <span className="font-normal text-[#95979d]">(optional, up to {MAX_SCREENING_QUESTIONS})</span>
        </legend>
        {v.screening_questions.map((q, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              aria-label={`Screening question ${i + 1}`}
              value={q}
              maxLength={300}
              onChange={(e) => set('screening_questions', v.screening_questions.map((x, j) => (j === i ? e.target.value : x)))}
              className="h-10 flex-1 rounded-lg border border-input bg-white px-3 text-sm"
            />
            <button type="button" onClick={() => set('screening_questions', v.screening_questions.filter((_, j) => j !== i))} className="text-[#95979d] hover:text-red-600" aria-label="Remove question">
              <X className="size-4" />
            </button>
          </div>
        ))}
        {v.screening_questions.length < MAX_SCREENING_QUESTIONS && (
          <button type="button" onClick={() => set('screening_questions', [...v.screening_questions, ''])} className="inline-flex items-center gap-1 text-sm font-semibold text-[#1dbf73]">
            <Plus className="size-4" /> Add a question
          </button>
        )}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField id="sp-deadline" label="Application deadline" optional type="date" value={v.application_deadline} onChange={(x) => set('application_deadline', x)} />
        <TextField id="sp-cap" label="Cap on applicants" optional value={v.applicant_cap} onChange={(x) => set('applicant_cap', x.replace(/\D/g, ''))} error={errors.applicant_cap} inputMode="numeric" />
      </div>
      <Toggle id="sp-urgent" checked={v.is_urgent} onChange={(x) => set('is_urgent', x)} label="Urgent" />
      <TextField id="sp-reviewers" label="Who reviews applications" optional hint="Teammates’ emails, separated by commas" value={v.reviewer_emails} onChange={(x) => set('reviewer_emails', x)} error={errors.reviewer_emails} />

      <SectionActions saving={saving} onSave={save} onSkip={onSkip} saveLabel="Save post" />
    </div>
  )
}
