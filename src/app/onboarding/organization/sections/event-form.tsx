'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { EVENT_AUDIENCES, EVENT_FORMATS, ORG_EVENT_TYPES } from '@/lib/onboarding/organization'
import { RadioCards, SelectField, TextAreaField, TextField, Toggle, YES_NO_OPTIONS } from '../../professional/ui'
import { saveListing } from '../actions'
import type { EventDraft } from '../shared'
import { OptionChips, SectionActions } from './fields'

export const EMPTY_EVENT: EventDraft = {
  event_type: '', title: '', description: '', date_later: false, starts_at: '', format: '',
  locations: '', capacity: '', is_free: false, price: '', offers_ceu: '', audiences: [],
}

/** B. Host an event or training (saved as a draft). */
export function EventForm({ onSaved, onSkip }: { onSaved: () => void; onSkip?: () => void }) {
  const [v, setV] = useState<EventDraft>(EMPTY_EVENT)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof EventDraft>(k: K, x: EventDraft[K]) => setV({ ...v, [k]: x })

  async function save() {
    setSaving(true)
    const res = await saveListing('event', v)
    setSaving(false)
    if (!res.ok) {
      setErrors(res.fields ?? {})
      toast.error(res.error)
      return
    }
    toast.success('Event saved as a draft')
    setErrors({})
    setV(EMPTY_EVENT)
    onSaved()
  }

  return (
    <div className="space-y-4">
      <SelectField id="evt-type" label="Type" value={v.event_type} onChange={(x) => set('event_type', x)} options={ORG_EVENT_TYPES} error={errors.event_type} />
      <TextField id="evt-title" label="Title" value={v.title} onChange={(x) => set('title', x)} error={errors.title} />
      <TextAreaField id="evt-desc" label="Description" value={v.description} onChange={(x) => set('description', x)} error={errors.description} />
      <div className="space-y-2">
        <Toggle id="evt-later" checked={v.date_later} onChange={(x) => set('date_later', x)} label="Set up the date later" />
        {!v.date_later && (
          <div className="max-w-[260px]">
            <TextField id="evt-when" label="Date and time" type="datetime-local" value={v.starts_at} onChange={(x) => set('starts_at', x)} error={errors.starts_at} />
          </div>
        )}
      </div>
      <RadioCards name="evt-format" legend="Format" options={EVENT_FORMATS} value={v.format as never} onChange={(x) => set('format', x)} error={errors.format} />
      {v.format && v.format !== 'virtual' && (
        <TextField id="evt-location" label="Location" value={v.locations} onChange={(x) => set('locations', x)} error={errors.locations} />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField id="evt-capacity" label="Capacity" optional value={v.capacity} onChange={(x) => set('capacity', x.replace(/\D/g, ''))} error={errors.capacity} inputMode="numeric" />
        <div className="space-y-2">
          <Toggle id="evt-free" checked={v.is_free} onChange={(x) => set('is_free', x)} label="Free" />
          {!v.is_free && (
            <TextField id="evt-price" label="Price ($)" value={v.price} onChange={(x) => set('price', x)} error={errors.price} inputMode="decimal" />
          )}
        </div>
      </div>
      <RadioCards name="evt-ceu" legend="Offers CEU/CME credit?" options={YES_NO_OPTIONS} value={v.offers_ceu} onChange={(x) => set('offers_ceu', x)} error={errors.offers_ceu} columns={2} />
      <OptionChips legend="Audience" options={EVENT_AUDIENCES} value={v.audiences} onChange={(x) => set('audiences', x)} error={errors.audiences} />
      <SectionActions saving={saving} onSave={save} onSkip={onSkip} saveLabel="Save event" />
    </div>
  )
}
