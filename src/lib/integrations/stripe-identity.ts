/**
 * Stripe Identity Integration
 * Docs: https://docs.stripe.com/identity
 *
 * Used alongside Persona for identity verification during provider
 * onboarding review — reuses the existing Stripe client/keys, no
 * separate credentials required.
 */

import { getStripe } from '@/lib/stripe/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StripeIdentityStatus =
  | 'requires_input'
  | 'processing'
  | 'verified'
  | 'canceled'
  | 'needs_review'

export interface CreateVerificationSessionRequest {
  /** Your internal contractor ID — stored in session metadata */
  contractorId: string
  /** URL to redirect to after the hosted verification flow completes */
  returnUrl: string
}

export interface CreateVerificationSessionResponse {
  sessionId: string
  status: StripeIdentityStatus
  /** Hosted verification URL to send the provider to */
  url: string | null
}

export interface VerificationSessionResult {
  sessionId: string
  status: StripeIdentityStatus
  verifiedOutputs: {
    firstName: string | null
    lastName: string | null
    documentType: string | null
  } | null
  lastError: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

// ---------------------------------------------------------------------------
// Mock responses (used when Stripe is not configured)
// ---------------------------------------------------------------------------

function mockCreateVerificationSession(
  req: CreateVerificationSessionRequest
): CreateVerificationSessionResponse {
  console.warn('[Stripe Identity] STRIPE_SECRET_KEY not set — returning mock manual-review response')
  return {
    sessionId: `mock_vs_${req.contractorId}`,
    status: 'needs_review',
    url: null,
  }
}

function mockGetVerificationSession(sessionId: string): VerificationSessionResult {
  console.warn('[Stripe Identity] STRIPE_SECRET_KEY not set — returning mock manual-review response')
  return {
    sessionId,
    status: 'needs_review',
    verifiedOutputs: null,
    lastError: 'Stripe Identity is not configured — requires manual review by an admin.',
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a hosted identity verification session for a provider.
 */
export async function createVerificationSession(
  request: CreateVerificationSessionRequest
): Promise<CreateVerificationSessionResponse> {
  if (!isConfigured()) {
    return mockCreateVerificationSession(request)
  }

  const stripe = getStripe()
  const session = await stripe.identity.verificationSessions.create({
    type: 'document',
    metadata: { contractor_id: request.contractorId },
    return_url: request.returnUrl,
    options: {
      document: { require_matching_selfie: true },
    },
  })

  return {
    sessionId: session.id,
    status: session.status as StripeIdentityStatus,
    url: session.url ?? null,
  }
}

/**
 * Retrieve the current result of an identity verification session.
 */
export async function getVerificationSession(
  sessionId: string
): Promise<VerificationSessionResult> {
  if (!isConfigured()) {
    return mockGetVerificationSession(sessionId)
  }

  const stripe = getStripe()
  const session = await stripe.identity.verificationSessions.retrieve(sessionId, {
    expand: ['last_verification_report'],
  })

  const report =
    typeof session.last_verification_report === 'object' &&
    session.last_verification_report !== null
      ? session.last_verification_report
      : null

  return {
    sessionId: session.id,
    status: session.status as StripeIdentityStatus,
    verifiedOutputs: report?.document?.first_name
      ? {
          firstName: report.document.first_name ?? null,
          lastName: report.document.last_name ?? null,
          documentType: report.document.type ?? null,
        }
      : null,
    lastError: session.last_error?.reason ?? null,
  }
}
