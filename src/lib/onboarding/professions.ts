// Screen 2 of professional onboarding ("What's your profession or
// specialty?"): a searchable list per category, or type your own. Seeded from
// the old wizard's LICENSE_TYPE_SUGGESTIONS and the Provider Directory tiers.
// Pure data — safe on server and client. Reword or extend freely: answers are
// stored as the text picked, never as an index.

import type { ProfessionalBranch } from '@/lib/onboarding/professional-branch'

export const PROFESSION_MAX = 100

/** Licensed clinical: license types. */
const CLINICAL = [
  'MD (Physician)',
  'DO (Osteopathic physician)',
  'NP (Nurse practitioner)',
  'PA (Physician assistant)',
  'RN (Registered nurse)',
  'LPN / LVN (Licensed practical or vocational nurse)',
  'CRNA (Nurse anesthetist)',
  'CNM (Certified nurse midwife)',
  'PT (Physical therapist)',
  'PTA (Physical therapist assistant)',
  'OT (Occupational therapist)',
  'SLP (Speech-language pathologist)',
  'RT (Respiratory therapist)',
  'LCSW (Licensed clinical social worker)',
  'LMFT (Marriage and family therapist)',
  'LPC / LPCC (Professional counselor)',
  'Psychologist',
  'PharmD (Pharmacist)',
  'RDN (Registered dietitian nutritionist)',
  'DC (Chiropractor)',
  'DPM (Podiatrist)',
  'DDS / DMD (Dentist)',
  'RDH (Dental hygienist)',
  'OD (Optometrist)',
  'Licensed acupuncturist (L.Ac.)',
  'Licensed midwife',
  'Paramedic / EMT',
]

/** Allied or certified: certification types. */
const ALLIED = [
  'Personal trainer',
  'Strength and conditioning coach',
  'Yoga instructor',
  'Pilates instructor',
  'Health and wellness coach',
  'Nutrition coach',
  'Life coach',
  'Doula',
  'Postpartum doula',
  'Lactation consultant (IBCLC)',
  'Childbirth educator',
  'Massage therapist',
  'Acupuncturist',
  'Esthetician',
  'Medical assistant',
  'Certified nursing assistant (CNA)',
  'Phlebotomist',
  'Pharmacy technician',
  'Sleep coach',
  'Recovery coach',
  'Community health worker',
  'Reiki practitioner',
]

/** Healthcare consultant: consulting specialties. */
const CONSULTANT = [
  'Healthcare attorney',
  'Compliance and HIPAA',
  'Medical billing and coding',
  'Revenue cycle management',
  'Credentialing',
  'Nurse consultant',
  'Legal nurse consultant',
  'Practice management',
  'Healthcare operations',
  'Quality and accreditation',
  'Clinical documentation',
  'Health IT and EHR',
  'Digital health and startups',
  'Healthcare marketing',
  'Healthcare finance',
  'Patient advocate',
  'Medical writer',
  'Regulatory affairs',
]

/** Educator or trainer: what they teach. */
const EDUCATOR = [
  'CEU courses for nurses',
  'CME courses for physicians',
  'BLS / ACLS / PALS',
  'CPR and first aid',
  'Certification prep',
  'Clinical skills workshops',
  'Wound care',
  'IV therapy training',
  'Aesthetics and injectables training',
  'Mental health first aid',
  'Nutrition education',
  'Fitness instructor training',
  'Childbirth education',
  'Leadership for healthcare teams',
  'Compliance and HIPAA training',
  'Billing and coding training',
]

export const PROFESSIONS_BY_BRANCH: Record<ProfessionalBranch, readonly string[]> = {
  clinical: CLINICAL,
  allied: ALLIED,
  consultant: CONSULTANT,
  educator: EDUCATOR,
}

/** Placeholder for the search box, by branch. */
export const PROFESSION_PLACEHOLDER: Record<ProfessionalBranch, string> = {
  clinical: 'Search license types, like RN or LCSW',
  allied: 'Search certifications, like doula or trainer',
  consultant: 'Search specialties, like billing or compliance',
  educator: 'Search topics, like CEU courses',
}

/** Case-insensitive match on any word start or the whole label. */
export function searchProfessions(list: readonly string[], query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return list.slice(0, limit)
  const starts: string[] = []
  const contains: string[] = []
  for (const p of list) {
    const l = p.toLowerCase()
    if (l.startsWith(q) || l.split(/[\s(/]+/).some((w) => w.startsWith(q))) starts.push(p)
    else if (l.includes(q)) contains.push(p)
  }
  return [...starts, ...contains].slice(0, limit)
}

/**
 * contractor_type enum value for a licensed-clinical pick (the enum predates
 * the category model; 'other' covers everything it doesn't list).
 */
export function contractorTypeFor(profession: string): string {
  const p = profession.trim().toUpperCase()
  const pairs: [RegExp, string][] = [
    [/^MD\b/, 'md'],
    [/^DO\b/, 'do'],
    [/^NP\b/, 'np'],
    [/^PA\b/, 'pa'],
    [/^RN\b/, 'rn'],
    [/^LPN\b/, 'lpn'],
    [/^PT\b/, 'pt'],
    [/^OT\b/, 'ot'],
    [/^SLP\b/, 'slp'],
    [/^RT\b/, 'rt'],
    [/^PHARMD\b/, 'pharm'],
    [/^LCSW\b/, 'sw'],
    [/^PARAMEDIC|^EMT\b/, 'emt'],
  ]
  for (const [re, v] of pairs) if (re.test(p)) return v
  return 'other'
}
