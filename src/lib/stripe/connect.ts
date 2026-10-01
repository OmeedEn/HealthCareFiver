import type Stripe from 'stripe'
import { getStripe } from './client'

/**
 * Where Stripe-hosted onboarding sends the professional back to. Whitelisted
 * so the API route never builds return URLs from arbitrary client input.
 */
export type ConnectReturnTarget = 'payments' | 'go-live'

const CONNECT_RETURN_PATHS: Record<
  ConnectReturnTarget,
  { returnPath: string; refreshPath: string }
> = {
  payments: {
    returnPath: '/contractor/payments?onboarded=true',
    refreshPath: '/contractor/payments?refresh=true',
  },
  'go-live': {
    returnPath: '/go-live?payouts=done',
    refreshPath: '/go-live#payouts',
  },
}

export function isConnectReturnTarget(value: unknown): value is ConnectReturnTarget {
  return typeof value === 'string' && value in CONNECT_RETURN_PATHS
}

/**
 * A connected account is ready to be paid once Stripe has its details and
 * both payouts and the transfers capability are enabled. Sanus uses
 * destination charges (the platform processes the charge), so the account
 * only needs `transfers` — `charges_enabled` reflects `card_payments`, which
 * we never request, so it must not gate readiness.
 */
export function isConnectAccountReady(account: Stripe.Account): boolean {
  return (
    account.details_submitted === true &&
    account.payouts_enabled === true &&
    account.capabilities?.transfers === 'active'
  )
}

/**
 * Creates an Express connected account. Express = Stripe-hosted onboarding
 * and a Stripe-hosted Express Dashboard; Stripe collects identity and bank
 * details (DOB, SSN digits, bank account) — they never touch Sanus.
 */
export async function createConnectAccount(email: string, userId: string) {
  const account = await getStripe().accounts.create({
    type: 'express',
    email,
    metadata: { userId },
    capabilities: {
      transfers: { requested: true },
    },
  })
  return account
}

/**
 * Stripe-hosted onboarding link (Account Links). `appUrl` falls back to
 * NEXT_PUBLIC_APP_URL.
 */
export async function createAccountLink(
  accountId: string,
  {
    target = 'payments',
    appUrl = process.env.NEXT_PUBLIC_APP_URL!,
  }: { target?: ConnectReturnTarget; appUrl?: string } = {}
) {
  const base = appUrl.replace(/\/+$/, '')
  const { returnPath, refreshPath } = CONNECT_RETURN_PATHS[target]
  const accountLink = await getStripe().accountLinks.create({
    account: accountId,
    refresh_url: `${base}${refreshPath}`,
    return_url: `${base}${returnPath}`,
    type: 'account_onboarding',
  })
  return accountLink
}

export async function getAccountStatus(accountId: string) {
  const account = await getStripe().accounts.retrieve(accountId)
  return {
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    ready: isConnectAccountReady(account),
  }
}

export async function createPaymentIntent({
  amount,
  platformFeeAmount,
  destinationAccountId,
  contractId,
  description,
}: {
  amount: number
  platformFeeAmount: number
  destinationAccountId: string
  contractId: string
  description: string
}) {
  const paymentIntent = await getStripe().paymentIntents.create({
    amount,
    currency: 'usd',
    application_fee_amount: platformFeeAmount,
    transfer_data: {
      destination: destinationAccountId,
    },
    metadata: {
      contractId,
    },
    description,
  })
  return paymentIntent
}

export async function createTransfer({
  amount,
  destinationAccountId,
  paymentIntentId,
  contractId,
}: {
  amount: number
  destinationAccountId: string
  paymentIntentId: string
  contractId: string
}) {
  const transfer = await getStripe().transfers.create({
    amount,
    currency: 'usd',
    destination: destinationAccountId,
    source_transaction: paymentIntentId,
    metadata: { contractId },
  })
  return transfer
}
