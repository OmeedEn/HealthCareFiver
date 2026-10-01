import type { ListingRow } from './offering'

/** Fictional listings shown in demo mode (no Supabase configured). */
const base = {
  contractor_id: 'demo-contractor-1',
  description: null,
  format: null,
  duration_minutes: null,
  engagement_type: null,
  custom_quote: false,
  event_type: null,
  starts_at: null,
  capacity: null,
  price_cents: null,
  is_free: false,
  involves_medical_procedures: false,
  requires_malpractice: false,
  review_notes: null,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
} satisfies Partial<ListingRow>

export const DEMO_LISTINGS: ListingRow[] = [
  {
    ...base,
    id: '00000000-0000-4000-8000-000000000001',
    kind: 'service',
    title: 'Virtual critical-care consult',
    description:
      'A 45-minute video session to review a recent ICU stay, discharge plan, or care questions with an experienced critical-care nurse.',
    format: 'virtual',
    duration_minutes: 45,
    price_cents: 9500,
    status: 'published',
  },
  {
    ...base,
    id: '00000000-0000-4000-8000-000000000002',
    kind: 'service',
    title: 'In-home post-discharge check',
    description: 'Vitals, medication review, and wound check at home.',
    format: 'home_visit',
    duration_minutes: 60,
    price_cents: 16000,
    requires_malpractice: true,
    status: 'draft',
  },
  {
    ...base,
    id: '00000000-0000-4000-8000-000000000003',
    kind: 'event',
    title: 'Family caregiver basics (live webinar)',
    event_type: 'webinar',
    is_free: true,
    price_cents: 0,
    status: 'rejected',
    review_notes:
      'Please remove "guaranteed to prevent readmission" from the description — we can’t list guaranteed-results language.',
  },
]

export function getDemoListing(id: string): ListingRow | null {
  return DEMO_LISTINGS.find((l) => l.id === id) ?? null
}
