'use client'

import {
  EVENT_AUDIENCES,
  EVENT_FORMATS,
  LISTING_FORMATS,
  ORG_EVENT_TYPES,
  REACH_VIA,
  SERVICE_AUDIENCES,
} from '@/lib/onboarding/organization'
import { TextAreaField, TextField, Toggle } from '../professional/ui'
import type { ActionResult } from './actions'
import type { Screen } from '@/components/onboarding/question-flow'
import { IconChoices, IconMultiChoices } from '@/components/onboarding/choices'
import {
  AUDIENCE_ICONS,
  EVENT_TYPE_ICONS,
  FORMAT_ICONS,
  REACH_VIA_ICONS,
  YES_NO_ICONS,
} from '@/components/onboarding/choice-icons'
import { checkFields, eventSchema, serviceSchema, type EventDraft, type ServiceDraft, type YesNo } from './shared'

/**
 * Question screens for a service or event listing, shared by onboarding
 * quick setup and the dashboard's Services & events page. `saveFields`
 * (optional) persists each screen's answers as they're given; `finish`
 * runs on the last screen.
 */
export interface ListingQuestions<T> {
  value: T
  set: <K extends keyof T>(k: K, v: T[K]) => void
  section: string
  saveFields?: (keys: string[]) => () => Promise<ActionResult>
  finish: () => Promise<ActionResult>
  finishLabel?: string
}

type ListingScreen = Omit<Screen, 'step'>

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const

const need = (cond: boolean, key: string, msg: string): Record<string, string> => (cond ? {} : { [key]: msg })

export function serviceScreens({ value, set, section, saveFields, finish, finishLabel }: ListingQuestions<ServiceDraft>): ListingScreen[] {
  const serviceCheck = (keys: (keyof ServiceDraft)[]) => checkFields(serviceSchema.shape, keys, { ...value })
  return [
    {
      id: 'svc_name',
      section,
      title: 'What service do you offer?',
      fields: ['title', 'description'],
      validate: () => serviceCheck(['title', 'description']),
      save: saveFields?.(['title', 'description']),
      render: ({ errors }) => (
        <>
          <TextField id="svc-title" label="Service name" value={value.title} onChange={(x) => set('title', x)} error={errors.title} placeholder="e.g. IV hydration therapy" />
          <TextAreaField id="svc-desc" label="Description" value={value.description} onChange={(x) => set('description', x)} error={errors.description} rows={4} />
        </>
      ),
    },
    {
      id: 'svc_audience',
      section,
      title: 'Who is it for?',
      sub: 'Pick all that apply.',
      fields: ['audiences'],
      validate: () => serviceCheck(['audiences']),
      save: saveFields?.(['audiences']),
      render: ({ errors }) => (
        <IconMultiChoices legend="Who it’s for" hideLegend options={SERVICE_AUDIENCES} icons={AUDIENCE_ICONS} value={value.audiences} onChange={(x) => set('audiences', x)} error={errors.audiences} />
      ),
    },
    {
      id: 'svc_format',
      section,
      title: 'How is it delivered?',
      fields: ['format', 'locations'],
      validate: () => ({
        ...serviceCheck(['format']),
        ...(value.format && value.format !== 'virtual'
          ? need(!!value.locations.trim(), 'locations', 'Add where it’s offered')
          : {}),
      }),
      save: saveFields?.(['format', 'locations']),
      render: ({ errors, advance }) => (
        <>
          <IconChoices
            legend="Format"
            hideLegend
            options={LISTING_FORMATS}
            icons={FORMAT_ICONS}
            value={value.format}
            onChange={(x) => {
              set('format', x)
              if (x === 'virtual') advance()
            }}
            error={errors.format}
          />
          {value.format && value.format !== 'virtual' && (
            <TextField id="svc-locations" label="Where is it offered?" value={value.locations} onChange={(x) => set('locations', x)} error={errors.locations} placeholder="e.g. Irvine and Tustin offices" />
          )}
        </>
      ),
    },
    {
      id: 'svc_price',
      section,
      title: 'What does it cost?',
      fields: ['price'],
      validate: () => ({
        ...serviceCheck(['price']),
        ...(!value.contact_for_pricing && !value.price
          ? { price: 'Add a price, or choose “Contact us for pricing”' }
          : {}),
      }),
      save: saveFields?.(['price']),
      render: ({ errors }) => (
        <>
          {!value.contact_for_pricing && (
            <div className="max-w-[220px]">
              <TextField id="svc-price" label="Price ($)" value={value.price} onChange={(x) => set('price', x)} error={errors.price} inputMode="decimal" />
            </div>
          )}
          <Toggle id="svc-contact" checked={value.contact_for_pricing} onChange={(x) => set('contact_for_pricing', x)} label="Contact us for pricing" />
        </>
      ),
    },
    {
      id: 'svc_reach',
      section,
      title: 'How should people reach you?',
      fields: ['reach_via'],
      validate: () => serviceCheck(['reach_via']),
      save: finish,
      continueLabel: finishLabel ?? 'Save service',
      render: ({ errors }) => (
        <IconChoices legend="How people reach you" hideLegend options={REACH_VIA} icons={REACH_VIA_ICONS} value={value.reach_via} onChange={(x) => set('reach_via', x)} error={errors.reach_via} columns={2} />
      ),
    },
  ]
}

export function eventScreens({ value, set, section, saveFields, finish, finishLabel }: ListingQuestions<EventDraft>): ListingScreen[] {
  const eventCheck = (keys: (keyof EventDraft)[]) => checkFields(eventSchema.shape, keys, { ...value })
  return [
    {
      id: 'evt_type',
      section,
      title: 'What kind of event is it?',
      fields: ['event_type'],
      validate: () => eventCheck(['event_type']),
      save: saveFields?.(['event_type']),
      render: ({ errors, advance }) => (
        <IconChoices
          legend="Event type"
          hideLegend
          options={ORG_EVENT_TYPES}
          icons={EVENT_TYPE_ICONS}
          value={value.event_type}
          onChange={(x) => {
            set('event_type', x)
            advance()
          }}
          error={errors.event_type}
          columns={2}
        />
      ),
    },
    {
      id: 'evt_name',
      section,
      title: 'What’s it called?',
      fields: ['title', 'description'],
      validate: () => eventCheck(['title', 'description']),
      save: saveFields?.(['title', 'description']),
      render: ({ errors }) => (
        <>
          <TextField id="evt-title" label="Title" value={value.title} onChange={(x) => set('title', x)} error={errors.title} />
          <TextAreaField id="evt-desc" label="Description" value={value.description} onChange={(x) => set('description', x)} error={errors.description} rows={4} />
        </>
      ),
    },
    {
      id: 'evt_when',
      section,
      title: 'When is it?',
      fields: ['starts_at'],
      validate: () => need(value.date_later || !!value.starts_at, 'starts_at', 'Pick a date and time, or “Set up the date later”'),
      save: saveFields?.(['starts_at']),
      render: ({ errors }) => (
        <>
          {!value.date_later && (
            <div className="max-w-[280px]">
              <TextField id="evt-when" label="Date and time" type="datetime-local" value={value.starts_at} onChange={(x) => set('starts_at', x)} error={errors.starts_at} />
            </div>
          )}
          <Toggle id="evt-later" checked={value.date_later} onChange={(x) => set('date_later', x)} label="Set up the date later" />
        </>
      ),
    },
    {
      id: 'evt_format',
      section,
      title: 'Where does it happen?',
      fields: ['format', 'locations'],
      validate: () => ({
        ...eventCheck(['format']),
        ...(value.format && value.format !== 'virtual'
          ? need(!!value.locations.trim(), 'locations', 'Add the location')
          : {}),
      }),
      save: saveFields?.(['format', 'locations']),
      render: ({ errors, advance }) => (
        <>
          <IconChoices
            legend="Format"
            hideLegend
            options={EVENT_FORMATS}
            icons={FORMAT_ICONS}
            value={value.format}
            onChange={(x) => {
              set('format', x)
              if (x === 'virtual') advance()
            }}
            error={errors.format}
          />
          {value.format && value.format !== 'virtual' && (
            <TextField id="evt-location" label="Location" value={value.locations} onChange={(x) => set('locations', x)} error={errors.locations} />
          )}
        </>
      ),
    },
    {
      id: 'evt_price',
      section,
      title: 'What does it cost, and how many can attend?',
      fields: ['price', 'capacity'],
      validate: () => ({
        ...eventCheck(['price', 'capacity']),
        ...(!value.is_free && !value.price ? { price: 'Add a price, or mark it free' } : {}),
      }),
      save: saveFields?.(['price', 'capacity']),
      render: ({ errors }) => (
        <>
          <div className="space-y-2">
            {!value.is_free && (
              <div className="max-w-[220px]">
                <TextField id="evt-price" label="Price ($)" value={value.price} onChange={(x) => set('price', x)} error={errors.price} inputMode="decimal" />
              </div>
            )}
            <Toggle id="evt-free" checked={value.is_free} onChange={(x) => set('is_free', x)} label="It’s free" />
          </div>
          <div className="max-w-[220px]">
            <TextField id="evt-capacity" label="Capacity" optional value={value.capacity} onChange={(x) => set('capacity', x.replace(/\D/g, ''))} error={errors.capacity} inputMode="numeric" />
          </div>
        </>
      ),
    },
    {
      id: 'evt_audience',
      section,
      title: 'Who is it for?',
      fields: ['audiences', 'offers_ceu'],
      validate: () => eventCheck(['audiences', 'offers_ceu']),
      save: finish,
      continueLabel: finishLabel ?? 'Save event',
      render: ({ errors }) => (
        <>
          <IconMultiChoices legend="Audience" options={EVENT_AUDIENCES} icons={AUDIENCE_ICONS} value={value.audiences} onChange={(x) => set('audiences', x)} error={errors.audiences} />
          <IconChoices legend="Offers CEU/CME credit?" options={YES_NO} icons={YES_NO_ICONS} value={value.offers_ceu} onChange={(x) => set('offers_ceu', x as YesNo)} error={errors.offers_ceu} columns={2} compact />
        </>
      ),
    },
  ]
}
