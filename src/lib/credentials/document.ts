/**
 * Credential documents (licenses, government IDs, background checks) live in
 * the PRIVATE `credentials` storage bucket at `{user_id}/{filename}`.
 *
 * `credentials.document_url` now stores that object PATH. Older rows hold a
 * full getPublicUrl() URL; credentialStoragePath() derives the path from
 * either form. Never link to document_url directly — use
 * credentialDocumentHref(), which goes through an authorized route that
 * issues a short-lived signed URL.
 *
 * Safe to import from client components (no server-only deps).
 */

export const CREDENTIALS_BUCKET = 'credentials'

const STORAGE_URL_PATTERN = new RegExp(
  `/storage/v1/object/(?:public|sign|authenticated)/${CREDENTIALS_BUCKET}/([^?#]+)`
)

/**
 * Object path within the credentials bucket, or null if `documentUrl` is
 * empty or points somewhere other than our credentials bucket.
 */
export function credentialStoragePath(
  documentUrl: string | null | undefined
): string | null {
  if (!documentUrl) return null

  if (/^https?:\/\//i.test(documentUrl)) {
    const match = documentUrl.match(STORAGE_URL_PATTERN)
    if (!match) return null
    try {
      return decodeURIComponent(match[1])
    } catch {
      return null
    }
  }

  const path = documentUrl.replace(/^\/+/, '')
  return path.startsWith(`${CREDENTIALS_BUCKET}/`)
    ? path.slice(CREDENTIALS_BUCKET.length + 1)
    : path
}

/** Same-origin URL that redirects an authorized viewer to a signed URL. */
export function credentialDocumentHref(credentialId: string): string {
  return `/api/credentials/${encodeURIComponent(credentialId)}/document`
}
