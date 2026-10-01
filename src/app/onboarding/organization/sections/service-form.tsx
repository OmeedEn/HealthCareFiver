'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { LISTING_FORMATS, REACH_VIA, SERVICE_AUDIENCES } from '@/lib/onboarding/organization'
import { RadioCards, TextAreaField, TextField, Toggle } from '../../professional/ui'
import { saveListing } from '../actions'
import type { ServiceDraft } from '../shared'
import { OptionChips, SectionActions } from './fields'

export const EMPTY_SERVICE: ServiceDraft = {
  title: '', description: '', audiences: [], format: '', locations: '', price: '',
  contact_for_pricing: false, reach_via: '',
}

/** A. Advertise a service (saved as a draft). */
export function ServiceForm({ onSaved, onSkip }: { onSaved: () => void; onSkip?: () => void }) {
  const [v, setV] = useState<ServiceDraft>(EMPTY_SERVICE)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof ServiceDraft>(k: K, x: ServiceDraft[K]) => setV({ ...v, [k]: x })

  async function save() {
    setSaving(true)
    const res = await saveListing('service', v)
    setSaving(false)
    if (!res.ok) {
      setErrors(res.fields ?? {})
      toast.error(res.error)
      return
    }
    toast.success('Service saved as a draft')
    setErrors({})
    setV(EMPTY_SERVICE)
    onSaved()
  }

  return (
    <div className="space-y-4">
      <TextField id="svc-title" label="Service name" value={v.title} onChange={(x) => set('title', x)} error={errors.title} />
      <TextAreaField id="svc-desc" label="Description" value={v.description} onChange={(x) => set('description', x)} error={errors.description} />
      <OptionChips legend="Who it’s for" options={SERVICE_AUDIENCES} value={v.audiences} onChange={(x) => set('audiences', x)} error={errors.audiences} />
      <RadioCards name="svc-format" legend="Format" options={LISTING_FORMATS} value={v.format as never} onChange={(x) => set('format', x)} error={errors.format} />
      {v.format && v.format !== 'virtual' && (
        <TextField id="svc-locations" label="Location(s)" value={v.locations} onChange={(x) => set('locations', x)} error={errors.locations} placeholder="e.g. Irvine and Tustin offices" />
      )}
      <div className="space-y-2">
        <Toggle id="svc-contact" checked={v.contact_for_pricing} onChange={(x) => set('contact_for_pricing', x)} label="Contact us for pricing" />
        {!v.contact_for_pricing && (
          <div className="max-w-[200px]">
            <TextField id="svc-price" label="Price ($)" value={v.price} onChange={(x) => set('price', x)} error={errors.price} inputMode="decimal" />
          </div>
        )}
      </div>
      <RadioCards name="svc-reach" legend="How people reach you" options={REACH_VIA} value={v.reach_via as never} onChange={(x) => set('reach_via', x)} error={errors.reach_via} columns={2} />
      <SectionActions saving={saving} onSave={save} onSkip={onSkip} saveLabel="Save service" />
    </div>
  )
}
