// Organization (facility) signup options. Shared by the signup page and the
// /api/auth/signup validator so stored keys never drift from the UI.
//
// facility_profiles has no columns for size or needs, so these are kept in
// auth user metadata (`org_size`, `org_needs`, `org_other_need`, `org_type`)
// until a migration adds real columns.

export const ORG_SIZES = ['1–10', '11–50', '51–200', '201–500', '500+'] as const
export type OrgSize = (typeof ORG_SIZES)[number]

export const ORG_NEEDS = [
  { key: 'clinical', label: 'Clinical services', sub: 'Nursing, PT, telehealth, direct care' },
  { key: 'consulting', label: 'Healthcare consulting', sub: 'Compliance, operations, billing, management' },
  { key: 'legal', label: 'Legal and regulatory expertise', sub: 'Attorneys, regulatory advisors' },
  { key: 'education', label: 'Education and staff training', sub: 'CEU, workshops, corporate wellness' },
  { key: 'nutrition', label: 'Nutrition and wellness programs', sub: 'RDNs, coaches, group programs' },
  { key: 'mental_health', label: 'Mental health services', sub: 'For staff or patients' },
  { key: 'it', label: 'Healthcare IT or EHR consulting', sub: 'Implementation, integration, audits' },
] as const

export type OrgNeedKey = (typeof ORG_NEEDS)[number]['key']

export const ORG_NEED_KEYS = ORG_NEEDS.map((n) => n.key) as [
  OrgNeedKey,
  ...OrgNeedKey[],
]

// UI-level organization types. Not all map to the `facility_type` Postgres
// enum; non-enum values are sent as 'other' with the raw key kept in
// metadata as `org_type`.
export const ORG_TYPES = [
  { value: 'hospital', label: 'Hospital or health system', enumValue: 'hospital' },
  { value: 'clinic', label: 'Clinic or medical practice', enumValue: 'clinic' },
  { value: 'asc', label: 'Ambulatory surgery center', enumValue: 'other' },
  { value: 'nursing_home', label: 'Nursing home or long-term care', enumValue: 'nursing_home' },
  { value: 'telehealth', label: 'Telehealth company', enumValue: 'telehealth' },
  { value: 'gym', label: 'Gym or fitness facility', enumValue: 'other' },
  { value: 'employer', label: 'Corporate employer (wellness programs)', enumValue: 'other' },
  { value: 'law_firm', label: 'Law firm (healthcare legal needs)', enumValue: 'other' },
  { value: 'startup', label: 'Startup or tech company', enumValue: 'other' },
  { value: 'staffing', label: 'Staffing or recruiting firm', enumValue: 'staffing_agency' },
  { value: 'other_health', label: 'Other healthcare business', enumValue: 'other' },
  { value: 'other_non_health', label: 'Other non-healthcare business', enumValue: 'other' },
] as const

export type OrgTypeKey = (typeof ORG_TYPES)[number]['value']

export const ORG_TYPE_KEYS = ORG_TYPES.map((t) => t.value) as [
  OrgTypeKey,
  ...OrgTypeKey[],
]
