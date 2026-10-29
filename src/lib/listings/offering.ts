/**
 * Listings (professional_offerings) managed from /contractor/listings.
 *
 * Same fields as onboarding step 5 (src/app/onboarding/professional), copied
 * here so the provider area doesn't depend on wizard internals. Imported by
 * both server actions and client components — keep it free of server-only
 * dependencies.
 */
import { z } from 'zod'

export type OfferingKind = 'service' | 'consulting' | 'event'

export type ListingStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'rejected'
  | 'paused'

/** Form state for one listing (strings as typed). */
export interface ListingDraft {
  kind: OfferingKind
  title: string
  description: string
  format: '' | 'virtual' | 'in_person' | 'home_visit'
  duration_minutes: string
  engagement_type: string
  custom_quote: boolean
  event_type: string
  /** value for <input type="datetime-local">, or '' */
  starts_at: string
  date_later: boolean
  capacity: string
  /** dollars as typed */
  price: string
  is_free: boolean
  /** Prescribing, injectables or IVs — needs malpractice coverage. */
  involves_medical_procedures: boolean
}

/** professional_offerings row as read by the provider area. */
export type ListingRow = {
  id: string
  contractor_id: string
  kind: OfferingKind
  title: string
  description: string | null
  format: 'virtual' | 'in_person' | 'home_visit' | null
  duration_minutes: number | null
  engagement_type: string | null
  custom_quote: boolean
  event_type: string | null
  starts_at: string | null
  capacity: number | null
  price_cents: number | null
  is_free: boolean
  status: ListingStatus
  created_at: string
  updated_at: string
  // v3 columns — null/false until the migration lands
  involves_medical_procedures: boolean
  requires_malpractice: boolean
  review_notes: string | null
}

export const LISTING_BASE_COLUMNS =
  'id, contractor_id, kind, title, description, format, duration_minutes, engagement_type, custom_quote, event_type, starts_at, capacity, price_cents, is_free, status, created_at, updated_at'
export const LISTING_V3_COLUMNS =
  'involves_medical_procedures, requires_malpractice, review_notes'

export const KIND_LABELS: Record<OfferingKind, string> = {
  service: 'Service',
  consulting: 'Consulting',
  event: 'Event',
}

export const SERVICE_FORMATS = [
  { value: 'virtual', label: 'Virtual' },
  { value: 'in_person', label: 'In person' },
  { value: 'home_visit', label: 'Home visit' },
] as const

export const ENGAGEMENT_TYPES = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'one_time', label: 'One-time session' },
  { value: 'project', label: 'Project-based' },
  { value: 'retainer', label: 'Monthly retainer' },
]

export const EVENT_TYPES = [
  { value: 'workshop', label: 'Workshop' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'ceu_course', label: 'CEU / CME course' },
  { value: 'certification_program', label: 'Certification program' },
  { value: 'class', label: 'Class or group session' },
  { value: 'conference', label: 'Conference or talk' },
]

export const MEDICAL_PROCEDURES_LABEL =
  'This involves prescribing, injectables, or IVs'

export const MALPRACTICE_SCOPE =
  'in-person care, home visits, prescribing, injectables, or IVs'

const label = (list: readonly { value: string; label: string }[], v: string | null) =>
  (v && list.find((o) => o.value === v)?.label) || null

export const formatLabel = (v: string | null) => label(SERVICE_FORMATS, v)
export const engagementLabel = (v: string | null) => label(ENGAGEMENT_TYPES, v)
export const eventTypeLabel = (v: string | null) => label(EVENT_TYPES, v)

/**
 * Mirrors the generated column requires_malpractice (in-person, home visit, or
 * prescribing/injectables/IVs). Used as a fallback before the migration lands
 * and for live form hints.
 */
export function needsMalpractice(l: {
  format: string | null | ''
  involves_medical_procedures: boolean | null
}): boolean {
  return (
    l.format === 'in_person' ||
    l.format === 'home_visit' ||
    !!l.involves_medical_procedures
  )
}

export function emptyListing(kind: OfferingKind): ListingDraft {
  return {
    kind,
    title: '',
    description: '',
    format: '',
    duration_minutes: kind === 'service' ? '60' : '',
    engagement_type: '',
    custom_quote: false,
    event_type: '',
    starts_at: '',
    date_later: false,
    capacity: '',
    price: '',
    is_free: false,
    involves_medical_procedures: false,
  }
}

function centsToDollars(c: number | null): string {
  if (c == null) return ''
  return c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2)
}

/** ISO → value for <input type="datetime-local"> in the viewer's timezone. */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Row → form state. starts_at stays ISO; the client converts it. */
export function rowToDraft(r: ListingRow): ListingDraft {
  return {
    kind: r.kind,
    title: r.title ?? '',
    description: r.description ?? '',
    format: r.format ?? '',
    duration_minutes: r.duration_minutes != null ? String(r.duration_minutes) : '',
    engagement_type: r.engagement_type ?? '',
    custom_quote: !!r.custom_quote,
    event_type: r.event_type ?? '',
    starts_at: r.starts_at ?? '',
    date_later: r.kind === 'event' && !r.starts_at,
    capacity: r.capacity != null ? String(r.capacity) : '',
    price: r.is_free ? '' : centsToDollars(r.price_cents),
    is_free: !!r.is_free,
    involves_medical_procedures: !!r.involves_medical_procedures,
  }
}

/* ───────────── Validation (server) ───────────── */

const req = (name: string, max = 200) =>
  z
    .string()
    .trim()
    .min(1, `${name} is required`)
    .max(max, `${name} must be ${max} characters or fewer`)

const dollars = z
  .string()
  .trim()
  .regex(/^\d{1,6}(\.\d{1,2})?$/, 'Enter a price in dollars, like 120 or 89.50')
  .transform((v) => Math.round(Number(v) * 100))

const medical = z.boolean().default(false)

export const listingSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('service'),
    title: req('Service name', 120),
    description: z.string().trim().max(1000),
    format: z.enum(['virtual', 'in_person', 'home_visit'], {
      error: 'Choose a format',
    }),
    price: dollars,
    duration_minutes: z
      .string()
      .trim()
      .regex(/^\d{1,4}$/, 'Enter a duration in minutes')
      .transform(Number)
      .pipe(z.number().int().min(5, 'At least 5 minutes').max(1440)),
    involves_medical_procedures: medical,
  }),
  z
    .object({
      kind: z.literal('consulting'),
      title: req('Consulting area', 120),
      description: z.string().trim().max(1000),
      engagement_type: z.enum(['hourly', 'one_time', 'project', 'retainer'], {
        error: 'Choose an engagement type',
      }),
      custom_quote: z.boolean(),
      price: z.string().trim(),
      involves_medical_procedures: medical,
    })
    .superRefine((v, ctx) => {
      if (!v.custom_quote && !dollars.safeParse(v.price).success) {
        ctx.addIssue({
          code: 'custom',
          path: ['price'],
          message: 'Enter a starting rate, or choose "I send custom quotes"',
        })
      }
    }),
  z
    .object({
      kind: z.literal('event'),
      event_type: z.enum(
        EVENT_TYPES.map((e) => e.value) as [string, ...string[]],
        { error: 'Choose an event type' }
      ),
      title: req('Event title', 120),
      description: z.string().trim().max(2000),
      date_later: z.boolean(),
      /** ISO timestamp (the client converts datetime-local before sending) */
      starts_at: z.string().trim(),
      capacity: z
        .string()
        .trim()
        .refine((v) => v === '' || /^\d{1,5}$/.test(v), 'Enter a number')
        .refine((v) => v === '' || Number(v) >= 1, 'At least 1 attendee'),
      is_free: z.boolean(),
      price: z.string().trim(),
      involves_medical_procedures: medical,
    })
    .superRefine((v, ctx) => {
      if (!v.date_later) {
        const t = Date.parse(v.starts_at)
        if (!v.starts_at || Number.isNaN(t)) {
          ctx.addIssue({
            code: 'custom',
            path: ['starts_at'],
            message: 'Pick a date, or choose "I\'ll set the date later"',
          })
        }
      }
      if (!v.is_free && !dollars.safeParse(v.price).success) {
        ctx.addIssue({
          code: 'custom',
          path: ['price'],
          message: 'Enter a price, or mark the event as free',
        })
      }
    }),
])

export type ListingInput = z.output<typeof listingSchema>

/** Validated input → professional_offerings columns (every kind's columns set,
 *  so switching kinds never leaves stale values behind). */
export function inputToColumns(v: ListingInput): Record<string, unknown> {
  const base = {
    kind: v.kind,
    title: v.title,
    description: v.description || null,
    format: null as string | null,
    duration_minutes: null as number | null,
    engagement_type: null as string | null,
    custom_quote: false,
    event_type: null as string | null,
    starts_at: null as string | null,
    capacity: null as number | null,
    price_cents: null as number | null,
    is_free: false,
    involves_medical_procedures: v.involves_medical_procedures,
  }
  if (v.kind === 'service') {
    return {
      ...base,
      format: v.format,
      duration_minutes: v.duration_minutes,
      price_cents: v.price,
    }
  }
  if (v.kind === 'consulting') {
    return {
      ...base,
      engagement_type: v.engagement_type,
      custom_quote: v.custom_quote,
      price_cents: v.custom_quote ? null : Math.round(Number(v.price) * 100),
    }
  }
  return {
    ...base,
    event_type: v.event_type,
    starts_at: v.date_later ? null : new Date(v.starts_at).toISOString(),
    capacity: v.capacity ? Number(v.capacity) : null,
    is_free: v.is_free,
    price_cents: v.is_free ? 0 : Math.round(Number(v.price) * 100),
  }
}

export function firstErrors(
  issues: { path: PropertyKey[]; message: string }[]
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const i of issues) {
    const key = i.path.map(String).join('.')
    if (key && !out[key]) out[key] = i.message
  }
  return out
}

/* ───────────── Display ───────────── */

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

/** Client-facing price line, e.g. "$120 · 60 min" or "Custom quote". */
export function priceLine(l: Pick<
  ListingRow,
  'kind' | 'price_cents' | 'is_free' | 'custom_quote' | 'duration_minutes' | 'engagement_type'
>): string {
  if (l.kind === 'event' && l.is_free) return 'Free'
  if (l.kind === 'consulting' && l.custom_quote) return 'Custom quote'
  if (l.price_cents == null) return 'Price on request'
  const price = formatCents(l.price_cents)
  if (l.kind === 'service' && l.duration_minutes) {
    return `${price} · ${l.duration_minutes} min`
  }
  if (l.kind === 'consulting') {
    const e = engagementLabel(l.engagement_type)
    return l.engagement_type === 'hourly' ? `From ${price}/hr` : e ? `From ${price} · ${e}` : `From ${price}`
  }
  if (l.kind === 'event') return `${price} per attendee`
  return price
}

/** Normalizes a raw DB row (v3 columns optional) into ListingRow. */
export function normalizeListingRow(raw: Record<string, unknown>): ListingRow {
  const r = raw as unknown as ListingRow
  const involves = raw.involves_medical_procedures === true
  const requires =
    typeof raw.requires_malpractice === 'boolean'
      ? raw.requires_malpractice
      : needsMalpractice({ format: r.format, involves_medical_procedures: involves })
  return {
    ...r,
    custom_quote: !!r.custom_quote,
    is_free: !!r.is_free,
    involves_medical_procedures: involves,
    requires_malpractice: requires,
    review_notes: typeof raw.review_notes === 'string' ? raw.review_notes : null,
  }
}

/* ───────────── One question at a time (listing QuestionFlow) ───────────── */

/**
 * Form state → what the save actions expect: an event's datetime-local value
 * becomes ISO in the browser's time zone (the server runs in UTC). Call on
 * the client only. An unparseable date is passed through so validation
 * reports it.
 */
export function draftToInput(d: ListingDraft): ListingDraft {
  if (d.kind !== 'event' || d.date_later || !d.starts_at) return { ...d, starts_at: '' }
  const t = Date.parse(d.starts_at)
  return { ...d, starts_at: Number.isNaN(t) ? d.starts_at : new Date(t).toISOString() }
}

/**
 * listingSchema's errors for just these fields. The whole listing is
 * validated (same rules as the full form and saveListing) and only the named
 * fields' errors are kept, so one screen can be checked before the questions
 * after it are answered.
 */
export function listingFieldErrors(input: unknown, keys: readonly string[]): Record<string, string> {
  const parsed = listingSchema.safeParse(input)
  if (parsed.success) return {}
  const all = firstErrors(parsed.error.issues)
  return Object.fromEntries(Object.entries(all).filter(([k]) => keys.includes(k)))
}

/** Fields one listing question can save on its own (saveListingStep). */
export const LISTING_STEP_KEYS = [
  'title',
  'description',
  'format',
  'duration_minutes',
  'engagement_type',
  'custom_quote',
  'event_type',
  'starts_at',
  'date_later',
  'capacity',
  'price',
  'is_free',
  'involves_medical_procedures',
] as const

const toCents = (v: string): number | null =>
  /^\d{1,6}(\.\d{1,2})?$/.test(v.trim()) ? Math.round(Number(v.trim()) * 100) : null

/**
 * professional_offerings columns for the answered fields only (same columns
 * and conversions as inputToColumns). `d` must already pass
 * listingFieldErrors for `keys`; starts_at is ISO (draftToInput).
 */
export function stepColumns(d: ListingDraft, keys: readonly string[]): Record<string, unknown> {
  const has = (k: string) => keys.includes(k)
  const c: Record<string, unknown> = {}
  if (has('title')) c.title = d.title.trim()
  if (has('description')) c.description = d.description.trim() || null
  if (has('involves_medical_procedures')) c.involves_medical_procedures = !!d.involves_medical_procedures
  if (d.kind === 'service') {
    if (has('format')) c.format = d.format || null
    if (has('duration_minutes')) c.duration_minutes = d.duration_minutes ? Number(d.duration_minutes) : null
    if (has('price')) c.price_cents = toCents(d.price)
  } else if (d.kind === 'consulting') {
    if (has('engagement_type')) c.engagement_type = d.engagement_type || null
    if (has('price') || has('custom_quote')) {
      c.custom_quote = !!d.custom_quote
      c.price_cents = d.custom_quote ? null : toCents(d.price)
    }
  } else {
    if (has('event_type')) c.event_type = d.event_type || null
    if (has('starts_at') || has('date_later')) c.starts_at = d.date_later || !d.starts_at ? null : d.starts_at
    if (has('capacity')) c.capacity = d.capacity ? Number(d.capacity) : null
    if (has('price') || has('is_free')) {
      c.is_free = !!d.is_free
      c.price_cents = d.is_free ? 0 : toCents(d.price)
    }
  }
  return c
}

/**
 * A saved listing has every answer listingSchema needs. Listings now save
 * question by question, so a draft can be unfinished; only finished ones
 * can be submitted for review.
 */
export function listingIsComplete(r: ListingRow): boolean {
  return listingSchema.safeParse(rowToDraft(r)).success
}
