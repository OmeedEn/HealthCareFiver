'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { US_STATES } from '@/lib/utils/constants'
import { formatUsPhoneInput } from '@/lib/phone'
import {
  ORG_DESCRIPTION_MAX,
  ORG_SIZES,
  ORG_TYPES,
  ORG_TYPE_OTHER_MAX,
} from '@/lib/onboarding/organization'
import {
  PRIMARY_BTN,
  SelectField,
  StepHeading,
  TextAreaField,
  TextField,
} from '../professional/ui'
import { saveAbout } from './actions'
import type { AboutData } from './shared'

export function StepAbout({
  value,
  onChange,
  onDone,
}: {
  value: AboutData
  onChange: (v: AboutData) => void
  onDone: () => void
}) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof AboutData>(k: K, v: AboutData[K]) => onChange({ ...value, [k]: v })

  async function next() {
    setSaving(true)
    const res = await saveAbout(value)
    setSaving(false)
    if (!res.ok) {
      setErrors(res.fields ?? {})
      toast.error(res.error)
      return
    }
    setErrors({})
    onDone()
  }

  return (
    <div className="space-y-6">
      <StepHeading
        title="About your organization"
        sub="This is what professionals and clients will see once you’re approved."
      />

      <TextField
        id="facility_name"
        label="Organization name"
        hint="As the public knows it."
        value={value.facility_name}
        onChange={(v) => set('facility_name', v)}
        error={errors.facility_name}
        autoComplete="organization"
      />

      <SelectField
        id="org_type"
        label="Organization type"
        value={value.org_type}
        onChange={(v) => set('org_type', v)}
        options={ORG_TYPES.map((t) => ({ value: t.value, label: t.label }))}
        error={errors.org_type}
        placeholder="Choose one…"
      />
      {value.org_type === 'other' && (
        <TextField
          id="org_type_other"
          label="What kind of organization?"
          value={value.org_type_other}
          onChange={(v) => set('org_type_other', v)}
          maxLength={ORG_TYPE_OTHER_MAX}
          error={errors.org_type_other}
        />
      )}

      <SelectField
        id="org_size"
        label="Organization size"
        value={value.org_size}
        onChange={(v) => set('org_size', v)}
        options={ORG_SIZES.map((s) => ({ value: s, label: `${s} people` }))}
        error={errors.org_size}
      />

      <div className="space-y-3">
        <p className="text-sm font-semibold text-[#404145]">Main location</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px_140px]">
          <TextField id="city" label="City" value={value.city} onChange={(v) => set('city', v)} error={errors.city} autoComplete="address-level2" />
          <SelectField id="state" label="State" value={value.state} onChange={(v) => set('state', v)} options={US_STATES} error={errors.state} />
          <TextField id="zip_code" label="ZIP" value={value.zip_code} onChange={(v) => set('zip_code', v)} error={errors.zip_code} inputMode="numeric" autoComplete="postal-code" />
        </div>
        <div className="max-w-[200px]">
          <TextField
            id="location_count"
            label="Number of locations"
            hint="You can add more later."
            value={value.location_count}
            onChange={(v) => set('location_count', v.replace(/\D/g, ''))}
            error={errors.location_count}
            inputMode="numeric"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField id="website" label="Website" value={value.website} onChange={(v) => set('website', v)} error={errors.website} placeholder="yourorganization.com" autoComplete="url" />
        <TextField
          id="org_phone"
          label="Organization phone"
          value={value.phone}
          onChange={(v) => set('phone', formatUsPhoneInput(v))}
          error={errors.phone}
          type="tel"
          inputMode="tel"
          placeholder="(555) 123-4567"
        />
      </div>

      <TextAreaField
        id="description"
        label="Short description"
        value={value.description}
        onChange={(v) => set('description', v)}
        maxLength={ORG_DESCRIPTION_MAX}
        counter
        error={errors.description}
        placeholder="What your organization does and who you serve."
      />

      <div className="flex justify-end">
        <Button type="button" onClick={next} disabled={saving} className={PRIMARY_BTN}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Continue
        </Button>
      </div>
    </div>
  )
}
