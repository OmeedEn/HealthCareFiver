/**
 * Shared types and upload rules for professional onboarding
 * (/onboarding/professional) and the dashboard's Finish your profile upload
 * items. Imported by server actions and client components alike, so it must
 * stay free of server-only dependencies. Question copy lives in
 * src/lib/onboarding/questions/professional.ts.
 */
import type { ProfessionalBranch } from '@/lib/onboarding/professional-branch'

/** Legacy step count for the old step indicator in ./ui (Progress). */
export const TOTAL_STEPS = 6

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fields?: Record<string, string> }

/** Upload slots on the single-question screens. */
export type DocSlotKey = 'credential' | 'government_id'

export type CredentialTypeValue = 'license' | 'certification' | 'resume' | 'government_id'

/** Screen 5: license (licensed), certification (allied), resume or CV (consultants, educators). */
export function credentialTypeFor(branch: ProfessionalBranch): CredentialTypeValue {
  return branch === 'clinical' ? 'license' : branch === 'allied' ? 'certification' : 'resume'
}

/** credential_type values that satisfy a slot (e.g. an older license upload for an allied pro). */
export function slotMatches(slot: DocSlotKey, branch: ProfessionalBranch): CredentialTypeValue[] {
  if (slot === 'government_id') return ['government_id']
  const own = credentialTypeFor(branch)
  return own === 'resume' ? ['resume'] : ['license', 'certification']
}

export const SLOT_LABEL: Record<CredentialTypeValue, string> = {
  license: 'Photo of license',
  certification: 'Photo of certification',
  resume: 'Resume or CV',
  government_id: 'Government ID',
}

export const MAX_DOC_BYTES = 10 * 1024 * 1024
// Matches the credential upload page (/contractor/credentials/upload).
export const DOC_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']
export const DOCX_MIME = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

export interface UploadedDoc {
  id: string
  credential_type: string
  name: string
  document_filename: string | null
  document_url: string | null
  status: string
}

/** A usable upload: has a file and wasn't rejected. */
export function isUsableDoc(d: { document_url: string | null; status: string }): boolean {
  return !!d.document_url && d.status !== 'rejected'
}
