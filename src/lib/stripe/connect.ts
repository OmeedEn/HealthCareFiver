import { getStripe } from './client'

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

export async function createAccountLink(accountId: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const accountLink = await getStripe().accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/contractor/payments?refresh=true`,
    return_url: `${appUrl}/contractor/payments?onboarded=true`,
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
