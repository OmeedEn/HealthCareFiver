import type { PublicOrg, PublicOrgListing } from './public'

// Fictional organizations and listings for demo mode (no Supabase).

export const DEMO_ORGS: PublicOrg[] = [
  {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    name: 'Harbor Wellness Clinic',
    orgType: 'clinic',
    orgTypeOther: null,
    description:
      'Primary care and IV therapy clinic serving Orange County. Same-week appointments, in person or by video.',
    city: 'Irvine',
    state: 'CA',
    averageRating: 4.8,
    totalReviews: 36,
  },
  {
    id: 'a1b2c3d4-0000-4000-8000-000000000002',
    name: 'Pacific Training Institute',
    orgType: 'ceu_training',
    orgTypeOther: null,
    description: 'CEU and certification courses for nurses and allied health professionals.',
    city: 'Costa Mesa',
    state: 'CA',
    averageRating: 4.6,
    totalReviews: 112,
  },
]

const inDays = (d: number, hour = 17) => {
  const t = new Date()
  t.setUTCDate(t.getUTCDate() + d)
  t.setUTCHours(hour, 0, 0, 0)
  return t.toISOString()
}

const [harbor, pacific] = DEMO_ORGS.map((o) => o.id)

export const DEMO_ORG_LISTINGS: PublicOrgListing[] = [
  {
    id: 'b1b2c3d4-0000-4000-8000-000000000001',
    orgId: harbor,
    kind: 'service',
    title: 'IV hydration therapy',
    description: '45-minute IV drip sessions with a registered nurse. Vitamin and electrolyte blends available.',
    audiences: ['individuals'],
    format: 'in_person',
    locations: 'Irvine office',
    priceCents: 15000,
    contactForPricing: false,
    isFree: false,
    reachVia: 'book',
    eventType: null,
    startsAt: null,
    capacity: null,
    offersCeu: null,
  },
  {
    id: 'b1b2c3d4-0000-4000-8000-000000000002',
    orgId: harbor,
    kind: 'service',
    title: 'Corporate flu shot clinic',
    description: 'On-site flu vaccination days for your team, run by our nursing staff.',
    audiences: ['businesses'],
    format: 'in_person',
    locations: 'At your workplace in Orange County',
    priceCents: null,
    contactForPricing: true,
    isFree: false,
    reachVia: 'inquiry',
    eventType: null,
    startsAt: null,
    capacity: null,
    offersCeu: null,
  },
  {
    id: 'b1b2c3d4-0000-4000-8000-000000000003',
    orgId: pacific,
    kind: 'event',
    title: 'BLS certification (AHA)',
    description: 'American Heart Association BLS provider course with hands-on skills check.',
    audiences: ['professionals'],
    format: 'in_person',
    locations: 'Costa Mesa training center',
    priceCents: 7500,
    contactForPricing: false,
    isFree: false,
    reachVia: 'book',
    eventType: 'certification',
    startsAt: inDays(9),
    capacity: 16,
    offersCeu: true,
  },
  {
    id: 'b1b2c3d4-0000-4000-8000-000000000004',
    orgId: pacific,
    kind: 'event',
    title: 'Wound care essentials webinar',
    description: 'A free one-hour webinar on assessment and dressing selection.',
    audiences: ['professionals', 'public'],
    format: 'virtual',
    locations: null,
    priceCents: null,
    contactForPricing: false,
    isFree: true,
    reachVia: 'book',
    eventType: 'webinar',
    startsAt: inDays(4, 18),
    capacity: 200,
    offersCeu: true,
  },
]
