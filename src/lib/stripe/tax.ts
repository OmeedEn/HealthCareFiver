/**
 * Stripe Tax — Tax Compliance
 * Docs: https://stripe.com/docs/tax
 *
 * Handles automatic tax calculation and collection for payments made
 * through the platform, including PaymentIntents, tax registrations,
 * and reporting.
 *
 * Uses the existing Stripe client from src/lib/stripe/client.ts.
 */

import { getStripe } from './client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaxCalculationRequest {
  /** Amount in cents (e.g., 5000 = $50.00) */
  amount: number
  /** ISO 3166-1 alpha-2 country code (e.g., "US") */
  country: string
  /** State/province code (e.g., "CA" for California) */
  state?: string
  /** Postal code for more precise tax calculation */
  postalCode?: string
  /** Stripe Tax product code or tax code (e.g., "txcd_10000000" for general services) */
  taxCode?: string
}

export interface TaxCalculationResult {
  /** Total tax amount in cents */
  taxAmount: number
  /** Effective tax rate as a decimal (e.g., 0.0875 for 8.75%) */
  taxRate: number
  /** Breakdown by jurisdiction */
  jurisdictions: TaxJurisdiction[]
  /** Whether this is a real calculation or mock data */
  isMock: boolean
}

export interface TaxJurisdiction {
  name: string
  rate: number
  amount: number
  level: 'country' | 'state' | 'county' | 'city' | 'district'
}

export interface TaxRegistrationRequest {
  /** ISO 3166-1 alpha-2 country code */
  country: string
  /** State/province code (required for US) */
  state?: string
  /** Registration type */
  type:
    | 'state_sales_tax'
    | 'simplified_seller_use_tax'
    | 'local_amusement_tax'
    | 'local_lease_tax'
    | 'local_communications_services_tax'
}

export interface TaxRegistrationResult {
  id: string
  country: string
  state: string | null
  status: 'active' | 'expired' | 'scheduled'
  isMock: boolean
}

export interface TaxReportRequest {
  /** Start date (ISO string or Unix timestamp) */
  startDate: string
  /** End date (ISO string or Unix timestamp) */
  endDate: string
}

export interface TaxReportResult {
  reportId: string
  status: 'pending' | 'succeeded' | 'failed'
  url: string | null
  isMock: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

// ---------------------------------------------------------------------------
// Mock responses
// ---------------------------------------------------------------------------

function mockTaxCalculation(request: TaxCalculationRequest): TaxCalculationResult {
  console.warn('[Stripe Tax] Stripe not configured — returning mock tax calculation')
  const mockRate = 0.0875 // 8.75% — rough average for US
  const taxAmount = Math.round(request.amount * mockRate)
  return {
    taxAmount,
    taxRate: mockRate,
    jurisdictions: [
      { name: request.state || 'State', rate: 0.06, amount: Math.round(request.amount * 0.06), level: 'state' },
      { name: 'County', rate: 0.0125, amount: Math.round(request.amount * 0.0125), level: 'county' },
      { name: 'City', rate: 0.015, amount: Math.round(request.amount * 0.015), level: 'city' },
    ],
    isMock: true,
  }
}

function mockTaxRegistration(request: TaxRegistrationRequest): TaxRegistrationResult {
  console.warn('[Stripe Tax] Stripe not configured — returning mock registration')
  return {
    id: `mock_txr_${Date.now()}`,
    country: request.country,
    state: request.state || null,
    status: 'active',
    isMock: true,
  }
}

function mockTaxReport(): TaxReportResult {
  console.warn('[Stripe Tax] Stripe not configured — returning mock report')
  return {
    reportId: `mock_rpt_${Date.now()}`,
    status: 'pending',
    url: null,
    isMock: true,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate tax for a given amount and location.
 *
 * Uses Stripe Tax Calculations API to determine the correct tax
 * amount and jurisdiction breakdown.
 */
export async function calculateTax(
  request: TaxCalculationRequest
): Promise<TaxCalculationResult> {
  if (!isStripeConfigured()) {
    return mockTaxCalculation(request)
  }

  const stripe = getStripe()

  const calculation = await stripe.tax.calculations.create({
    currency: 'usd',
    line_items: [
      {
        amount: request.amount,
        reference: 'shift_service',
        tax_code: request.taxCode || 'txcd_10000000', // General services
      },
    ],
    customer_details: {
      address: {
        country: request.country,
        state: request.state,
        postal_code: request.postalCode,
      },
      address_source: 'shipping',
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jurisdictions: TaxJurisdiction[] = (
    (calculation as any).tax_breakdown || []
  ).map((b: any) => ({
    name: b.jurisdiction?.display_name ?? 'Tax',
    rate: Number(b.rate ?? 0),
    amount: b.amount ?? 0,
    level: (b.jurisdiction?.level ?? 'state') as TaxJurisdiction['level'],
  }))

  return {
    taxAmount: calculation.tax_amount_exclusive,
    taxRate:
      request.amount > 0
        ? calculation.tax_amount_exclusive / request.amount
        : 0,
    jurisdictions,
    isMock: false,
  }
}

/**
 * Enable automatic tax collection on a PaymentIntent.
 *
 * Call this when creating a PaymentIntent for a shift payment to
 * ensure tax is automatically calculated and collected.
 *
 * Returns the PaymentIntent creation params with tax settings applied.
 */
export function withAutomaticTax(params: {
  amount: number
  currency?: string
  metadata?: Record<string, string>
  [key: string]: unknown
}) {
  return {
    ...params,
    currency: params.currency || 'usd',
    automatic_tax: { enabled: true },
  }
}

/**
 * Create a tax registration for the platform in a given jurisdiction.
 *
 * Required before Stripe can calculate and collect tax in that state.
 * Typically done once per state during platform setup.
 */
export async function createTaxRegistration(
  request: TaxRegistrationRequest
): Promise<TaxRegistrationResult> {
  if (!isStripeConfigured()) {
    return mockTaxRegistration(request)
  }

  const stripe = getStripe()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const registration = await stripe.tax.registrations.create({
    country: request.country,
    country_options: {
      us: {
        state: request.state!,
        type: request.type as any,
      },
    },
    active_from: 'now',
  })

  return {
    id: registration.id,
    country: registration.country,
    state: request.state || null,
    status: registration.status as TaxRegistrationResult['status'],
    isMock: false,
  }
}

/**
 * Generate a tax summary report for a date range.
 *
 * Uses Stripe Reporting API to generate a downloadable tax report.
 */
export async function generateTaxReport(
  request: TaxReportRequest
): Promise<TaxReportResult> {
  if (!isStripeConfigured()) {
    return mockTaxReport()
  }

  const stripe = getStripe()

  const reportRun = await stripe.reporting.reportRuns.create({
    report_type: 'tax.transactions.itemized.5',
    parameters: {
      interval_start: Math.floor(new Date(request.startDate).getTime() / 1000),
      interval_end: Math.floor(new Date(request.endDate).getTime() / 1000),
    },
  })

  return {
    reportId: reportRun.id,
    status: reportRun.status as TaxReportResult['status'],
    url: reportRun.result?.url || null,
    isMock: false,
  }
}
