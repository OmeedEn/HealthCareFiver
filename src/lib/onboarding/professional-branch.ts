/**
 * Which onboarding "branch" (step-3 questions, step-4 documents, compliance
 * questions) a professional falls into.
 *
 * The four listed categories map to themselves. "Other (my profession isn't
 * listed)" is routed by the answer to "Do you hold a state license or
 * professional certification?" (contractor_profiles.credential_basis):
 *   license       → clinical   (licensed-clinical questions)
 *   certification → allied     (allied / certified questions)
 *   none          → consultant (consultant questions)
 *
 * "Allied or certified" asks "Do you have any certifications?" (same
 * column; certifications are optional): certification (or no answer, as on
 * accounts from before the question) → allied; none → consultant, i.e. a
 * website / LinkedIn link and a resume or CV instead of a certification.
 *
 * Pure and dependency-free so it can be shared by server actions, client
 * components, admin and dashboard code.
 */

export type ProfessionalCategory =
  | 'clinical'
  | 'allied'
  | 'consultant'
  | 'educator'
  | 'other'

export type ProfessionalBranch = 'clinical' | 'allied' | 'consultant' | 'educator'

export type CredentialBasis = 'license' | 'certification' | 'none'

export const PROFESSIONAL_CATEGORIES: readonly ProfessionalCategory[] = [
  'clinical',
  'allied',
  'consultant',
  'educator',
  'other',
]

export const CREDENTIAL_BASES: readonly CredentialBasis[] = [
  'license',
  'certification',
  'none',
]

export function isProfessionalCategory(v: unknown): v is ProfessionalCategory {
  return typeof v === 'string' && (PROFESSIONAL_CATEGORIES as readonly string[]).includes(v)
}

export function isCredentialBasis(v: unknown): v is CredentialBasis {
  return typeof v === 'string' && (CREDENTIAL_BASES as readonly string[]).includes(v)
}

/**
 * Resolve the branch for a category (+ credential basis, meaningful for
 * 'other' and 'allied'). An 'other' professional without a valid basis — which the wizard
 * never allows to be saved — falls back to 'consultant', the branch that asks
 * for no license/certification data.
 */
export function effectiveBranch(
  category: ProfessionalCategory | string | null | undefined,
  credentialBasis: CredentialBasis | string | null | undefined
): ProfessionalBranch {
  switch (category) {
    case 'allied':
      return credentialBasis === 'none' ? 'consultant' : 'allied'
    case 'clinical':
    case 'consultant':
    case 'educator':
      return category
    case 'other':
      if (credentialBasis === 'license') return 'clinical'
      if (credentialBasis === 'certification') return 'allied'
      return 'consultant'
    default:
      return 'consultant'
  }
}

/**
 * Licensed and allied branches answer the practice question
 * (offers_high_risk_services) and the self-disclosure questions.
 */
export function branchHasComplianceQuestions(branch: ProfessionalBranch): boolean {
  return branch === 'clinical' || branch === 'allied'
}
