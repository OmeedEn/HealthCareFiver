'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode, DEMO_PAYMENTS } from '@/lib/demo/data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StripeConnectButton } from '@/components/payments/stripe-connect-button'
import { PaymentHistory } from '@/components/payments/payment-history'
import { formatCurrency } from '@/lib/utils/format'
import { DollarSign, Clock, Lock, Loader2 } from 'lucide-react'

interface Payment {
  id: string
  created_at: string
  amount: number
  platform_fee: number
  net_amount: number
  status: string
  invoice_url?: string | null
  contracts: {
    title: string
  } | null
}

interface SummaryData {
  totalEarned: number
  pending: number
  inEscrow: number
}

function computeSummary(payments: Payment[]): SummaryData {
  const totalEarned = payments
    .filter((p) => p.status === 'released')
    .reduce((sum, p) => sum + (p.net_amount ?? 0), 0)
  const pending = payments
    .filter((p) => p.status === 'pending' || p.status === 'processing')
    .reduce((sum, p) => sum + (p.net_amount ?? 0), 0)
  const inEscrow = payments
    .filter((p) => p.status === 'in_escrow')
    .reduce((sum, p) => sum + (p.net_amount ?? 0), 0)
  return { totalEarned, pending, inEscrow }
}

export default function ContractorPaymentsPage() {
  const isDemo = isDemoMode()
  const initialDemoPayments = isDemo
    ? (DEMO_PAYMENTS as unknown as Payment[])
    : []
  const [payments, setPayments] = useState<Payment[]>(() => initialDemoPayments)
  const [summary, setSummary] = useState<SummaryData>(() =>
    isDemo ? computeSummary(initialDemoPayments) : { totalEarned: 0, pending: 0, inEscrow: 0 }
  )
  const [isOnboarded, setIsOnboarded] = useState(isDemo)
  const [loading, setLoading] = useState(!isDemo)

  useEffect(() => {
    if (isDemo) return

    async function fetchData() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      // Check Stripe onboarding status
      const { data: profile } = await supabase
        .from('contractor_profiles')
        .select('stripe_account_id, stripe_onboarded')
        .eq('id', user.id)
        .single()

      setIsOnboarded(!!profile?.stripe_onboarded)

      // Fetch payments
      const { data: paymentData } = await supabase
        .from('payments')
        .select('id, created_at, amount, platform_fee, net_amount, status, invoice_url, contracts(title)')
        .eq('payee_id', user.id)
        .order('created_at', { ascending: false })

      const fetchedPayments = (paymentData ?? []) as unknown as Payment[]
      setPayments(fetchedPayments)

      setSummary(computeSummary(fetchedPayments))
      setLoading(false)
    }

    fetchData()
  }, [isDemo])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const formattedPayments = payments.map((p) => ({
    id: p.id,
    created_at: p.created_at,
    description: p.contracts?.title ?? 'Payment',
    amount: p.amount,
    platform_fee: p.platform_fee,
    net_amount: p.net_amount,
    status: p.status,
    invoice_url: p.invoice_url,
  }))

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold">Payments</h1>

      <StripeConnectButton isOnboarded={isOnboarded} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Earned
            </CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(summary.totalEarned)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(summary.pending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Escrow
            </CardTitle>
            <Lock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(summary.inEscrow)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentHistory payments={formattedPayments} userRole="contractor" />
        </CardContent>
      </Card>
    </div>
  )
}
