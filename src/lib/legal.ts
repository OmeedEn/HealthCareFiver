/**
 * Version of the Terms of Service + Privacy Policy a user agrees to at
 * signup. Bump this whenever /terms or /privacy materially change so we can
 * tell which version each account accepted (stored in auth user metadata as
 * `terms_version`, alongside a server-side `terms_accepted_at` timestamp).
 */
export const TERMS_VERSION = '2026-09-30'

export const TERMS_PATH = '/terms'
export const PRIVACY_PATH = '/privacy'

/**
 * Version of the Independent Contractor and Platform Agreement a professional
 * accepts at /go-live. Passed to the accept_contractor_agreement(p_version)
 * RPC, which stamps contractor_profiles.contractor_agreement_accepted_at /
 * contractor_agreement_version. Bump when /legal/contractor-agreement
 * materially changes.
 */
export const CONTRACTOR_AGREEMENT_VERSION = '2026-09-30'

export const CONTRACTOR_AGREEMENT_PATH = '/legal/contractor-agreement'
