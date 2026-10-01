'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { US_STATES } from '@/lib/utils/constants'
import {
  HIRING_TIMELINES,
  LOOKING_FOR_ENGAGEMENTS,
  PROFESSIONAL_TIERS,
  WORK_SETTINGS,
} from '@/lib/onboarding/organization'
import { RadioCards, TextField } from '../../professional/ui'
import { saveLookingFor } from '../actions'
import type { LookingForData } from '../shared'
import { OptionChips, SectionActions } from './fields'

const VALID_STATES = new Set(US_STATES.map((s) => s.value))

export const EMPTY_LOOKING_FOR: LookingForData = {
  types: [], specialties: '', engagement_types: [], settings: [], timeline: '', license_states: [], min_years: '',
}

/** C. "Looking for" profile, so Sanus can suggest matching professionals. */
export function LookingForForm({
  initial = EMPTY_LOOKING_FOR,
  onSaved,
  onSkip,
}: {
  initial?: LookingForData
  onSaved: () => void
  onSkip?: () => void
}) {
  const [v, setV] = useState<LookingForData>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [statesText, setStatesText] = useState(initial.license_states.join(', '))
  const set = <K extends keyof LookingForData>(k: K, x: LookingForData[K]) => setV({ ...v, [k]: x })

  async function save() {
    setSaving(true)
    const res = await saveLookingFor(v)
    setSaving(false)
    if (!res.ok) {
      setErrors(res.fields ?? {})
      toast.error(res.error)
      return
    }
    toast.success('Saved — we’ll use this to suggest professionals')
    setErrors({})
    onSaved()
  }

  return (
    <div className="space-y-4">
      <OptionChips legend="Professional types you’re looking for" options={PROFESSIONAL_TIERS} value={v.types} onChange={(x) => set('types', x)} error={errors.types} />
      <TextField id="lf-specialties" label="Specialties" optional hint="Separate with commas, e.g. pediatrics, IV therapy" value={v.specialties} onChange={(x) => set('specialties', x)} error={errors.specialties} />
      <OptionChips legend="Engagement types" options={LOOKING_FOR_ENGAGEMENTS} value={v.engagement_types} onChange={(x) => set('engagement_types', x)} error={errors.engagement_types} />
      <OptionChips legend="Setting" options={WORK_SETTINGS} value={v.settings} onChange={(x) => set('settings', x)} error={errors.settings} />
      <RadioCards name="lf-timeline" legend="Timeline" options={HIRING_TIMELINES} value={v.timeline as never} onChange={(x) => set('timeline', x)} error={errors.timeline} />
      <TextField
        id="lf-states"
        label="License state(s) required"
        optional
        hint="Two-letter codes, e.g. CA, NV"
        value={statesText}
        onChange={(x) => {
          setStatesText(x)
          set(
            'license_states',
            Array.from(new Set(x.toUpperCase().split(/[\s,]+/).filter((c) => VALID_STATES.has(c))))
          )
        }}
      />
      <div className="max-w-[220px]">
        <TextField id="lf-years" label="Minimum years of experience" optional value={v.min_years} onChange={(x) => set('min_years', x.replace(/\D/g, '').slice(0, 2))} error={errors.min_years} inputMode="numeric" />
      </div>
      <SectionActions saving={saving} onSave={save} onSkip={onSkip} />
    </div>
  )
}
