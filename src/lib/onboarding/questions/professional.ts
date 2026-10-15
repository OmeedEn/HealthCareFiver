// Professional onboarding question config (Single-Question Onboarding spec,
// "Professional: /signup/professional"). Question ids, exact copy, options,
// who sees each screen, and what's skippable live here as data; the screens
// in src/app/(flow)/signup/professional and src/app/onboarding/professional
// render from it. Reword / reorder here.
//
// Ids are stable: they're stored in onboarding_progress.answered / .skipped
// and drive resume + the Finish your profile checklist.
//
// Pure — safe on server and client.

import { z } from 'zod'
import { US_STATES } from '@/lib/utils/constants'
import {
  effectiveBranch,
  branchHasComplianceQuestions,
  type CredentialBasis,
  type ProfessionalBranch,
  type ProfessionalCategory,
} from '@/lib/onboarding/professional-branch'
import { PROFESSION_MAX, contractorTypeFor } from '@/lib/onboarding/professions'

/** sessionStorage key for the pre-account answers (usePreAccountAnswers). */
export const PRO_PRE_ACCOUNT_KEY = 'professional'

/* ───────────── Question ids ───────────── */

export const PRO_Q = {
  category: 'category',
  profession: 'profession',
  otherProfession: 'other_profession',
  credentialBasis: 'credential_basis',
  license: 'license',
  certifyingOrg: 'certifying_org',
  website: 'website',
  account: 'account',
  credentialUpload: 'credential_upload',
  governmentId: 'government_id',
  disclosures: 'disclosures',
  submit: 'submit',
} as const
export type ProQuestionId = (typeof PRO_Q)[keyof typeof PRO_Q]

/* ───────────── Copy (exact spec wording) ───────────── */

export const PRO_COPY = {
  category: 'What kind of professional are you?',
  profession: 'What’s your profession or specialty?',
  otherProfession: 'What’s your profession?',
  credentialBasis: 'Do you hold a state license or certification?',
  license: 'What’s your license number?',
  licenseWhy: 'We check this with your state licensing board.',
  certifyingOrg: 'Which organization certified you?',
  website: 'Share a link to your website or LinkedIn.',
  noWebsite: 'I don’t have one',
  account: 'Create your account',
  accountSub: 'Free to join.',
  upload: {
    clinical: 'Upload a photo of your license',
    allied: 'Upload a photo of your certification',
    consultant: 'Upload your resume or CV',
    educator: 'Upload your resume or CV',
  } satisfies Record<ProfessionalBranch, string>,
  uploadSub: 'Private and encrypted. Only our verification team can see it.',
  governmentId: 'Upload a photo of your government ID',
  governmentIdWhy: 'Only used to confirm you are you.',
  disclosures: 'Do any of these apply to you?',
  disclosuresWhy:
    'Convictions and malpractice judgments don’t show up in our lookups, so this is the only place we learn about them.',
  disclosuresNone: 'None of these apply',
  disclosuresMore: 'Tell us a bit more',
  submit: 'Confirm and submit',
  attestAccurate: 'I certify this information is accurate and will notify Sanus of any changes.',
  authorizeChecks:
    'I authorize Sanus to verify my credentials with licensing boards and run exclusion screenings.',
  submitButton: 'Submit my application',
} as const

/** Screen 1 options (spec descriptions). */
export const CATEGORY_OPTIONS: { value: ProfessionalCategory; label: string; sub: string }[] = [
  { value: 'clinical', label: 'Licensed clinical', sub: 'MD, DO, NP, PA, RN, PT, LCSW, RDN, and more' },
  {
    value: 'allied',
    label: 'Allied or certified',
    sub: 'Trainer, coach, doula, acupuncturist, massage therapist, and more',
  },
  {
    value: 'consultant',
    label: 'Healthcare consultant',
    sub: 'Attorney, compliance, billing, nursing consultant, and more',
  },
  { value: 'educator', label: 'Educator or trainer', sub: 'CEU courses, workshops, certification programs' },
  { value: 'other', label: 'Other', sub: 'My profession isn’t listed' },
]

export const CREDENTIAL_BASIS_OPTIONS: { value: CredentialBasis; label: string }[] = [
  { value: 'license', label: 'State license' },
  { value: 'certification', label: 'Certification' },
  { value: 'none', label: 'Neither' },
]

/** Screen 7 options → the existing self_disclosures jsonb keys (admin flags read these). */
export const DISCLOSURE_OPTIONS = [
  { value: 'license_action', label: 'License ever suspended, revoked, restricted, surrendered, or investigated' },
  { value: 'exclusion', label: 'Excluded from Medicare or Medicaid' },
  { value: 'conviction', label: 'Felony or healthcare-related conviction' },
  { value: 'malpractice', label: 'Malpractice judgment or settlement' },
] as const
export type DisclosureKey = (typeof DISCLOSURE_OPTIONS)[number]['value']
export const DISCLOSURE_KEYS = DISCLOSURE_OPTIONS.map((o) => o.value) as DisclosureKey[]
export const DISCLOSURE_DETAILS_MAX = 2000

/* ───────────── Pre-account answers (screens 1–3) ───────────── */

export interface ProSignupAnswers {
  category: ProfessionalCategory | ''
  /** Screen 2 pick or typed text (not for Other). */
  profession: string
  /** Other: "What's your profession?" */
  other_profession: string
  /** Other: license / certification / none. */
  credential_basis: CredentialBasis | ''
  license_number: string
  license_state: string
  certifying_organization: string
  website_url: string
  /** "I don't have one" on the website screen. */
  no_website: boolean
}

export const EMPTY_PRO_ANSWERS: ProSignupAnswers = {
  category: '',
  profession: '',
  other_profession: '',
  credential_basis: '',
  license_number: '',
  license_state: '',
  certifying_organization: '',
  website_url: '',
  no_website: false,
}

/** Branch once enough is known (Other needs its basis), else null. */
export function branchOf(a: Pick<ProSignupAnswers, 'category' | 'credential_basis'>): ProfessionalBranch | null {
  if (!a.category) return null
  if (a.category === 'other' && !a.credential_basis) return null
  return effectiveBranch(a.category, a.credential_basis || null)
}

/** Screen 3 id for a branch. */
export function identityScreenFor(branch: ProfessionalBranch): ProQuestionId {
  return branch === 'clinical' ? PRO_Q.license : branch === 'allied' ? PRO_Q.certifyingOrg : PRO_Q.website
}

/**
 * Pre-account screen ids this person sees, in order. Before the branch is
 * known, screen 3 is counted as a placeholder so the bar doesn't jump.
 */
export function preAccountScreenIds(a: Pick<ProSignupAnswers, 'category' | 'credential_basis'>): ProQuestionId[] {
  const ids: ProQuestionId[] = [PRO_Q.category]
  if (a.category === 'other') ids.push(PRO_Q.otherProfession, PRO_Q.credentialBasis)
  else ids.push(PRO_Q.profession)
  const branch = branchOf(a)
  ids.push(branch ? identityScreenFor(branch) : PRO_Q.license)
  return ids
}

/** Post-account screen ids (5–8). Consultants and educators skip 7. */
export function postAccountScreenIds(branch: ProfessionalBranch | null): ProQuestionId[] {
  const ids: ProQuestionId[] = [PRO_Q.credentialUpload, PRO_Q.governmentId]
  if (!branch || branchHasComplianceQuestions(branch)) ids.push(PRO_Q.disclosures)
  ids.push(PRO_Q.submit)
  return ids
}

/** Skippable screens (beta: every upload). Skips become checklist items. */
export const PRO_SKIPPABLE: ReadonlySet<string> = new Set([PRO_Q.credentialUpload, PRO_Q.governmentId])

/* ───────────── Validation ───────────── */

const STATE_CODES = new Set(US_STATES.map((s) => s.value))

/** Accepts "example.com" or "linkedin.com/in/x" and normalizes to https://… */
export function normalizeWebsiteUrl(raw: string): string | null {
  const v = raw.trim()
  if (!v || v.length > 500) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (!u.hostname.includes('.') || u.hostname.endsWith('.')) return null
    return u.toString()
  } catch {
    return null
  }
}

/** Per-screen answer checks for the client (Continue stays disabled until true). */
export const proValid = {
  profession: (v: string) => v.trim().length > 0 && v.trim().length <= PROFESSION_MAX,
  licenseNumber: (v: string) => /^[A-Za-z0-9][A-Za-z0-9 .\-/#]{0,49}$/.test(v.trim()),
  state: (v: string) => STATE_CODES.has(v),
  certifyingOrg: (v: string) => v.trim().length > 0 && v.trim().length <= 150,
  website: (v: string) => normalizeWebsiteUrl(v) !== null,
}

const text = (max: number) => z.string().trim().max(max).default('')

/**
 * Screens 1–3 as sent with the signup request (email) or carried in the
 * Google cookie. Checked against the branch they imply.
 */
export const proAnswersSchema = z
  .object({
    category: z.enum(['clinical', 'allied', 'consultant', 'educator', 'other'], {
      error: 'Choose what kind of professional you are',
    }),
    profession: text(PROFESSION_MAX),
    other_profession: text(PROFESSION_MAX),
    credential_basis: z.enum(['license', 'certification', 'none', '']).default(''),
    license_number: text(50),
    license_state: text(2),
    certifying_organization: text(150),
    website_url: text(500),
    no_website: z.boolean().default(false),
  })
  .superRefine((a, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
    if (a.category === 'other') {
      if (!a.other_profession) issue('other_profession', 'Tell us your profession')
      if (!a.credential_basis) issue('credential_basis', 'Tell us whether you hold a license or certification')
    } else if (!a.profession) {
      issue('profession', 'Tell us your profession or specialty')
    }
    const branch = effectiveBranch(a.category, a.credential_basis || null)
    if (branch === 'clinical') {
      if (!proValid.licenseNumber(a.license_number)) issue('license_number', 'Enter your license number')
      if (!proValid.state(a.license_state)) issue('license_state', 'Choose the state that issued your license')
    } else if (branch === 'allied') {
      if (!proValid.certifyingOrg(a.certifying_organization)) {
        issue('certifying_organization', 'Tell us which organization certified you')
      }
    } else if (!a.no_website && !proValid.website(a.website_url)) {
      issue('website_url', 'Enter a link like linkedin.com/in/yourname, or choose “I don’t have one”')
    }
  })
export type ProAnswersInput = z.input<typeof proAnswersSchema>
export type ProAnswersParsed = z.output<typeof proAnswersSchema>

/**
 * contractor_profiles columns for screens 1–3, plus the question ids they
 * answer. Only the branch's own fields are written.
 */
export function contractorColumnsFromAnswers(a: ProAnswersParsed): {
  columns: Record<string, unknown>
  answered: ProQuestionId[]
} {
  const isOther = a.category === 'other'
  const branch = effectiveBranch(a.category, a.credential_basis || null)
  const columns: Record<string, unknown> = {
    professional_category: a.category,
    other_profession: isOther ? a.other_profession : null,
    credential_basis: isOther ? a.credential_basis : null,
  }
  const answered: ProQuestionId[] = [PRO_Q.category]
  if (isOther) answered.push(PRO_Q.otherProfession, PRO_Q.credentialBasis)
  else {
    Object.assign(columns, professionColumns(a.category as ProfessionalBranch, a.profession))
    answered.push(PRO_Q.profession)
  }
  if (branch === 'clinical') {
    columns.state_license_number = a.license_number
    columns.license_state = a.license_state
    columns.license_states = [a.license_state]
    answered.push(PRO_Q.license)
  } else if (branch === 'allied') {
    columns.certifying_organization = a.certifying_organization
    answered.push(PRO_Q.certifyingOrg)
  } else {
    columns.website_url = a.no_website ? null : normalizeWebsiteUrl(a.website_url)
    answered.push(PRO_Q.website)
  }
  return { columns, answered }
}

/** Where screen 2's answer is stored, by category. */
export function professionColumns(category: ProfessionalBranch, profession: string): Record<string, unknown> {
  const p = profession.trim()
  switch (category) {
    case 'clinical':
      return { license_type: p, contractor_type: contractorTypeFor(p) }
    case 'allied':
      return { certification_type: p }
    case 'consultant':
      return { specialties: [p] }
    case 'educator':
      return { teaching_topics: p }
  }
}
