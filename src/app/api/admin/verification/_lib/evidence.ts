/** Private bucket for screenshots/PDFs of verification lookups (admin-only). */
export const EVIDENCE_BUCKET = 'verification-evidence'

export const EVIDENCE_MAX_BYTES = 15 * 1024 * 1024

export const EVIDENCE_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
]

export const CHECK_KEY_RE = /^[a-z0-9_]{1,64}$/

export function safeFilename(name: string): string {
  const cleaned = name
    .replace(/[/\\]/g, '_')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .slice(-100)
  return cleaned || 'evidence'
}

/** `{contractorId}/{checkKey}/` — every evidence object lives under this prefix. */
export function evidencePrefix(contractorId: string, checkKey: string): string {
  return `${contractorId}/${checkKey}/`
}
