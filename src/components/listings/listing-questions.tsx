'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Briefcase,
  CalendarDays,
  CalendarRange,
  Clock,
  FolderKanban,
  Repeat,
  ShieldAlert,
  Stethoscope,
} from 'lucide-react'
import type { ActionResult, Screen } from '@/components/onboarding/question-flow'
import { IconChoices } from '@/components/onboarding/choices'
import { EVENT_TYPE_ICONS, FORMAT_ICONS, YES_NO_ICONS, type ChoiceIcons } from '@/components/onboarding/choice-icons'
import { TextAreaField, TextField, Toggle } from '@/app/onboarding/professional/ui'
import { saveListing, saveListingStep } from '@/app/(dashboard)/contractor/listings/actions'
import {
  ENGAGEMENT_TYPES,
  EVENT_TYPES,
  SERVICE_FORMATS,
  draftToInput,
  emptyListing,
  isoToLocalInput,
  listingFieldErrors,
  needsMalpractice,
  rowToDraft,
  type ListingDraft,
  type ListingRow,
  type OfferingKind,
} from '@/lib/listings/offering'

/*
 * A professional listing (service, consulting, event) one question per
 * screen, for /contractor/listings/new and the go-live flow. Same fields,
 * validation (listingSchema) and columns as the full ListingForm, which is
 * still used to edit an existing listing. Every answer saves as it's given
 * (saveListingStep): the first answer with a title creates the draft, so
 * leaving halfway leaves a draft to finish later. The last question saves
 * the whole listing through saveListing.
 */

const KIND_OPTIONS = [
  { value: 'service', label: 'Service', sub: 'Bookable sessions or visits' },
  { value: 'consulting', label: 'Consulting', sub: 'Advisory work and projects' },
  { value: 'event', label: 'Event or class', sub: 'Workshops, classes, CEU courses' },
] as const
const KIND_ICONS: ChoiceIcons = { service: Stethoscope, consulting: Briefcase, event: CalendarDays }
const ENGAGEMENT_ICONS: ChoiceIcons = {
  hourly: Clock,
  one_time: CalendarRange,
  project: FolderKanban,
  retainer: Repeat,
}
const PRO_EVENT_ICONS: ChoiceIcons = {
  ...EVENT_TYPE_ICONS,
  certification_program: EVENT_TYPE_ICONS.certification,
  class: EVENT_TYPE_ICONS.workshop,
}
const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const

/**
 * The hands-on question (Single-Question Onboarding spec). Any yes makes
 * malpractice coverage a "Needed after approval" item: saving starts it via
 * startInsuranceGraceForListing. Asked right after the title so even an
 * unfinished draft has it.
 */
const HANDS_ON_QUESTION =
  'Will this involve in-person or hands-on care, home visits, prescribing, injectables, or IVs?'
type HandsOn = '' | 'yes' | 'no'

/** Where a saved draft's answers stop (the hands-on answer isn't its own column). */
function handsOnOf(r: ListingRow): HandsOn {
  if (r.involves_medical_procedures) return 'yes'
  const later =
    r.kind === 'service'
      ? r.format != null
      : r.kind === 'consulting'
        ? r.engagement_type != null
        : r.starts_at != null || r.capacity != null || r.price_cents != null
  return later ? 'no' : ''
}

export interface ListingFlowState {
  /** Screens for the listing, all with step 1. The first is the kind question. */
  screens: Screen[]
  listingId: string | null
  draft: ListingDraft | null
  /** Index (within `screens`) of the first unanswered question. */
  firstOpen: () => number
  /** The kind screen was skipped: later listing screens are left out. */
  skipped: boolean
}

export function useListingQuestions({
  row = null,
  initialKind,
  insured,
  kindTitle = 'What kind of listing is this?',
  kindSub,
  skippable,
  onSkip,
}: {
  /** An unfinished draft to continue. */
  row?: ListingRow | null
  initialKind?: OfferingKind
  /** Provider has a reviewed malpractice certificate. */
  insured: boolean
  kindTitle?: string
  kindSub?: string
  /** The go-live flow lets people add a listing later. */
  skippable?: boolean
  onSkip?: () => Promise<ActionResult> | void
}): ListingFlowState {
  const [draft, setDraft] = useState<ListingDraft | null>(() => {
    if (row) {
      const d = rowToDraft(row)
      return { ...d, starts_at: d.starts_at ? isoToLocalInput(d.starts_at) : '' }
    }
    return initialKind ? emptyListing(initialKind) : null
  })
  const [handsOn, setHandsOn] = useState<HandsOn>(() => (row ? handsOnOf(row) : ''))
  const [listingId, setListingId] = useState<string | null>(row?.id ?? null)
  // Answered before the draft existed (an event's type comes before its title).
  const [pending, setPending] = useState<string[]>([])
  const [skipped, setSkipped] = useState(false)

  const set = (patch: Partial<ListingDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d))
  const check = (keys: string[]) => () => (draft ? listingFieldErrors(draftToInput(draft), keys) : {})

  const saveStep = (keys: string[]) => async (): Promise<ActionResult> => {
    if (!draft) return { ok: false, error: 'Choose what kind of listing this is.' }
    const sendKeys = listingId ? keys : Array.from(new Set([...pending, ...keys]))
    const res = await saveListingStep(listingId, draftToInput(draft), sendKeys)
    if (!res.ok) return res
    if (res.id) {
      setListingId(res.id)
      setPending([])
    } else {
      setPending(sendKeys)
    }
    return { ok: true }
  }

  const saveAll = async (): Promise<ActionResult> => {
    if (!draft) return { ok: false, error: 'Choose what kind of listing this is.' }
    const res = await saveListing(listingId, draftToInput(draft))
    if (!res.ok) return { ok: false, error: res.error, fields: res.fieldErrors }
    setListingId(res.id)
    return { ok: true }
  }

  const kindScreen: Screen = {
    id: 'listing_kind',
    step: 1,
    title: kindTitle,
    sub: kindSub,
    autoAdvance: true,
    canContinue: () => draft !== null,
    skippable,
    onSkip: async () => {
      const res = await onSkip?.()
      if (res && !res.ok) return res
      setSkipped(true)
      return { ok: true }
    },
    render: ({ advance }) => (
      <IconChoices
        legend="Kind of listing"
        hideLegend
        options={KIND_OPTIONS}
        icons={KIND_ICONS}
        columns={1}
        value={draft?.kind ?? ''}
        onChange={(k) => {
          const kind = k as OfferingKind
          setSkipped(false)
          // A saved draft keeps its title and description if the kind changes.
          setDraft((d) =>
            d?.kind === kind
              ? d
              : { ...emptyListing(kind), title: d?.title ?? '', description: d?.description ?? '' }
          )
          advance()
        }}
      />
    ),
  }

  if (!draft || skipped) {
    return { screens: [kindScreen], listingId, draft, skipped, firstOpen: () => 0 }
  }

  const kind = draft.kind
  const err = (e: Record<string, string>, k: string) => e[k]

  const titleScreen: Screen = {
    id: 'listing_title',
    step: 1,
    title:
      kind === 'service'
        ? 'What’s the service?'
        : kind === 'consulting'
          ? 'What do you consult on?'
          : 'What’s the event called?',
    fields: ['title', 'description'],
    validate: check(['title', 'description']),
    save: saveStep(['title', 'description']),
    render: ({ errors }) => (
      <>
        <TextField
          id="listing-title"
          label={kind === 'service' ? 'Service name' : kind === 'consulting' ? 'Area' : 'Title'}
          value={draft.title}
          onChange={(v) => set({ title: v })}
          error={err(errors, 'title')}
          placeholder={
            kind === 'service'
              ? 'e.g., Initial nutrition consult'
              : kind === 'consulting'
                ? 'e.g., HIPAA compliance program build-out'
                : 'e.g., Wound care essentials (2 CE hours)'
          }
        />
        <TextAreaField
          id="listing-description"
          label="Short description"
          optional
          value={draft.description}
          onChange={(v) => set({ description: v })}
          error={err(errors, 'description')}
          rows={4}
        />
      </>
    ),
  }

  const malpracticeNote = (
    <p className="flex items-start gap-2 rounded-lg border border-[#e4e5e7] bg-[#fafafa] p-3 text-sm text-[#404145]">
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[#8a6508]" aria-hidden="true" />
      <span>
        This needs malpractice coverage.{' '}
        {insured ? (
          'Your certificate is on file and reviewed.'
        ) : (
          <>
            It can go live once your malpractice certificate is reviewed.{' '}
            <Link
              href="/contractor/credentials/upload?type=malpractice_insurance"
              className="font-semibold text-[#1dbf73] hover:underline"
            >
              Upload it anytime
            </Link>
          </>
        )}
      </span>
    </p>
  )

  const handsOnScreen: Screen = {
    id: 'listing_hands_on',
    step: 1,
    title: HANDS_ON_QUESTION,
    fields: ['involves_medical_procedures'],
    autoAdvance: true,
    canContinue: () => handsOn !== '',
    save: saveStep(['involves_medical_procedures']),
    render: ({ advance }) => (
      <>
        <IconChoices
          legend="Hands-on care"
          hideLegend
          options={YES_NO}
          icons={YES_NO_ICONS}
          columns={2}
          value={handsOn}
          onChange={(v) => {
            setHandsOn(v as HandsOn)
            set({ involves_medical_procedures: v === 'yes' })
            advance()
          }}
        />
        {handsOn === 'yes' && malpracticeNote}
      </>
    ),
  }

  const priceField = (errors: Record<string, string>, label: string, disabled: boolean, placeholder: string) => (
    <div className="max-w-[240px]">
      <TextField
        id="listing-price"
        label={label}
        value={disabled ? '' : draft.price}
        onChange={(v) => set({ price: v })}
        error={err(errors, 'price')}
        inputMode="decimal"
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  )

  let rest: Screen[]
  if (kind === 'service') {
    rest = [
      {
        id: 'listing_format',
        step: 1,
        title: 'How do you deliver it?',
        fields: ['format'],
        autoAdvance: true,
        canContinue: () => !!draft.format,
        save: saveStep(['format']),
        render: ({ errors, advance }) => (
          <>
            <IconChoices
              legend="Format"
              hideLegend
              options={SERVICE_FORMATS}
              icons={FORMAT_ICONS}
              value={draft.format}
              onChange={(v) => {
                set({ format: v as ListingDraft['format'] })
                advance()
              }}
              error={err(errors, 'format')}
            />
            {needsMalpractice(draft) && handsOn !== 'yes' && malpracticeNote}
          </>
        ),
      },
      {
        id: 'listing_price',
        step: 1,
        title: 'What does a session cost, and how long is it?',
        fields: ['price', 'duration_minutes'],
        validate: check(['price', 'duration_minutes']),
        save: saveAll,
        continueLabel: 'Save listing',
        render: ({ errors }) => (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="listing-price"
              label="Price (USD)"
              value={draft.price}
              onChange={(v) => set({ price: v })}
              error={err(errors, 'price')}
              inputMode="decimal"
              placeholder="e.g., 120"
            />
            <TextField
              id="listing-duration"
              label="Duration (minutes)"
              value={draft.duration_minutes}
              onChange={(v) => set({ duration_minutes: v.replace(/\D/g, '').slice(0, 4) })}
              error={err(errors, 'duration_minutes')}
              inputMode="numeric"
              placeholder="e.g., 60"
            />
          </div>
        ),
      },
    ]
  } else if (kind === 'consulting') {
    rest = [
      {
        id: 'listing_engagement',
        step: 1,
        title: 'How do you usually work with clients?',
        fields: ['engagement_type'],
        autoAdvance: true,
        canContinue: () => !!draft.engagement_type,
        save: saveStep(['engagement_type']),
        render: ({ errors, advance }) => (
          <IconChoices
            legend="Engagement type"
            hideLegend
            options={ENGAGEMENT_TYPES}
            icons={ENGAGEMENT_ICONS}
            columns={2}
            value={draft.engagement_type}
            onChange={(v) => {
              set({ engagement_type: v })
              advance()
            }}
            error={err(errors, 'engagement_type')}
          />
        ),
      },
      {
        id: 'listing_rate',
        step: 1,
        title: 'What’s your starting rate?',
        fields: ['price', 'custom_quote'],
        validate: check(['price', 'custom_quote']),
        save: saveAll,
        continueLabel: 'Save listing',
        render: ({ errors }) => (
          <>
            {priceField(errors, 'Starting rate (USD)', draft.custom_quote, draft.custom_quote ? 'Custom quotes' : 'e.g., 200')}
            <Toggle id="listing-custom-quote" checked={draft.custom_quote} onChange={(v) => set({ custom_quote: v })} label="I send custom quotes" />
          </>
        ),
      },
    ]
  } else {
    rest = [
      {
        id: 'listing_date',
        step: 1,
        title: 'When is it?',
        fields: ['starts_at', 'date_later'],
        validate: check(['starts_at', 'date_later']),
        save: saveStep(['starts_at', 'date_later']),
        render: ({ errors }) => (
          <>
            <TextField
              id="listing-starts-at"
              label="Date and time"
              type="datetime-local"
              value={draft.date_later ? '' : draft.starts_at}
              onChange={(v) => set({ starts_at: v })}
              error={err(errors, 'starts_at')}
              disabled={draft.date_later}
            />
            <Toggle id="listing-date-later" checked={draft.date_later} onChange={(v) => set({ date_later: v })} label="I’ll set the date later" />
          </>
        ),
      },
      {
        id: 'listing_capacity',
        step: 1,
        title: 'How many people can attend?',
        optional: true,
        fields: ['capacity'],
        validate: check(['capacity']),
        save: saveStep(['capacity']),
        render: ({ errors }) => (
          <div className="max-w-[240px]">
            <TextField
              id="listing-capacity"
              label="Capacity"
              value={draft.capacity}
              onChange={(v) => set({ capacity: v.replace(/\D/g, '').slice(0, 5) })}
              error={err(errors, 'capacity')}
              inputMode="numeric"
              placeholder="Max attendees"
            />
          </div>
        ),
      },
      {
        id: 'listing_event_price',
        step: 1,
        title: 'What does it cost to attend?',
        fields: ['price', 'is_free'],
        validate: check(['price', 'is_free']),
        save: saveAll,
        continueLabel: 'Save listing',
        render: ({ errors }) => (
          <>
            {priceField(errors, 'Price per attendee (USD)', draft.is_free, draft.is_free ? 'Free' : 'e.g., 49')}
            <Toggle id="listing-free" checked={draft.is_free} onChange={(v) => set({ is_free: v })} label="It’s free" />
          </>
        ),
      },
    ]
  }

  const eventType: Screen[] =
    kind === 'event'
      ? [
          {
            id: 'listing_event_type',
            step: 1,
            title: 'What kind of event?',
            fields: ['event_type'],
            autoAdvance: true,
            canContinue: () => !!draft.event_type,
            save: saveStep(['event_type']),
            render: ({ errors, advance }) => (
              <IconChoices
                legend="Event type"
                hideLegend
                options={EVENT_TYPES}
                icons={PRO_EVENT_ICONS}
                columns={2}
                value={draft.event_type}
                onChange={(v) => {
                  set({ event_type: v })
                  advance()
                }}
                error={err(errors, 'event_type')}
              />
            ),
          },
        ]
      : []

  const screens = [kindScreen, ...eventType, titleScreen, handsOnScreen, ...rest]

  // Continuing a draft: the first question without a valid answer.
  const firstOpen = () => {
    const i = screens.findIndex(
      (s) => (s.canContinue && !s.canContinue()) || Object.keys(s.validate?.() ?? {}).length > 0
    )
    return i === -1 ? screens.length - 1 : i
  }

  return { screens, listingId, draft, skipped, firstOpen }
}
