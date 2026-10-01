import type { ListingRow } from './listings-client'

/** Sample listings so the review queue renders in demo mode. */
const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString()

export const DEMO_LISTINGS: ListingRow[] = [
  {
    id: 'demo-listing-1',
    contractorId: 'demo-applicant-1',
    providerName: 'Sarah Johnson',
    category: 'clinical',
    otherProfession: null,
    licensed: true,
    scope: 'Licensed: Registered Nurse (RN) (CA, AZ) · IV therapy',
    kind: 'service',
    title: 'In-home IV hydration',
    description:
      'Rehydrate at home with a licensed RN. Guaranteed to cure your hangover in 30 minutes — 100% results.',
    format: 'home_visit',
    involvesMedicalProcedures: true,
    requiresMalpractice: true,
    insured: false,
    priceCents: 17500,
    isFree: false,
    status: 'pending_review',
    reviewNotes: null,
    reviewedAt: null,
    updatedAt: hoursAgo(3),
    publishBlockers: ['needs reviewed malpractice coverage'],
  },
  {
    id: 'demo-listing-2',
    contractorId: 'demo-applicant-5',
    providerName: 'Alex Rivera',
    category: 'consultant',
    otherProfession: null,
    licensed: false,
    scope: 'Consultant, unlicensed · Clinic operations. Advisory only — no clinical care.',
    kind: 'consulting',
    title: 'Clinic operations review',
    description: 'A 60-minute virtual review of your intake and scheduling workflows.',
    format: 'virtual',
    involvesMedicalProcedures: false,
    requiresMalpractice: false,
    insured: false,
    priceCents: 25000,
    isFree: false,
    status: 'pending_review',
    reviewNotes: null,
    reviewedAt: null,
    updatedAt: hoursAgo(20),
    publishBlockers: [],
  },
]
