'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode, DEMO_PAYMENTS } from '@/lib/demo/data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StripeConnectButton } from '@/components/payments/stripe-connect-button'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import {
  DollarSign,
  Clock,
  Lock,
  Wallet,
  Loader2,
  CreditCard,
  FileText,
} from 'lucide-react'

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
  paidOut: number
  pending: number
  inEscrow: number
}

function computeSummary(payments: Payment[]): SummaryData {
  const paidOut = payments
    .filter((p) => p.status === 'released' || p.status === 'paid')
    .reduce((sum, p) => sum + (p.net_amount ?? 0), 0)
  const pending = payments
    .filter((p) => p.status === 'pending' || p.status === 'processing')
    .reduce((sum, p) => sum + (p.net_amount ?? 0), 0)
  const inEscrow = payments
    .filter((p) => p.status === 'in_escrow')
    .reduce((sum, p) => sum + (p.net_amount ?? 0), 0)
  const totalEarned = paidOut + pending + inEscrow
  return { totalEarned, paidOut, pending, inEscrow }
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: string
  description: string
  icon: React.ElementType
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-[#62646a]">{title}</CardTitle>
        <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#1dbf73]/10 to-[#1dbf73]/20">
          <Icon className="size-4 text-[#1dbf73]" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-[#404145]">{value}</div>
        <p className="mt-1 text-xs text-[#62646a]">{description}</p>
      </CardContent>
    </Card>
  )
}

function PaymentStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase()
  const label = normalized
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  if (normalized === 'released' || normalized === 'paid') {
    return (
      <Badge className="bg-[#e8faf1] text-[#0f8f56] hover:bg-[#e8faf1]">
        {label}
      </Badge>
    )
  }
  if (normalized === 'in_escrow') {
    return <Badge variant="outline">{label}</Badge>
  }
  if (normalized === 'pending' || normalized === 'processing') {
    return <Badge variant="secondary">{label}</Badge>
  }
  if (
    normalized === 'failed' ||
    normalized === 'refunded' ||
    normalized === 'disputed'
  ) {
    return <Badge variant="destructive">{label}</Badge>
  }
  return <Badge variant="secondary">{label}</Badge>
}

export default function ContractorPaymentsPage() {
  const isDemo = isDemoMode()
  const initialDemoPayments = isDemo
    ? (DEMO_PAYMENTS as unknown as Payment[])
    : []
  const [payments, setPayments] = useState<Payment[]>(() => initialDemoPayments)
  const [summary, setSummary] = useState<SummaryData>(() =>
    isDemo
      ? computeSummary(initialDemoPayments)
      : { totalEarned: 0, paidOut: 0, pending: 0, inEscrow: 0 }
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
        .from('profiles')
        .select('stripe_connect_id, stripe_connect_onboarded')
        .eq('id', user.id)
        .single()

      setIsOnboarded(!!profile?.stripe_connect_onboarded)

      // Fetch payments
      const { data: paymentData } = await supabase
        .from('payments')
        .select(
          'id, created_at, amount, platform_fee, net_amount, status, invoice_url, contracts(title)'
        )
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
        <Loader2 className="size-6 animate-spin text-[#1dbf73]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#404145]">Payments</h1>
        <p className="text-[#62646a]">
          Track your earnings, escrow balance, and payout history.
        </p>
      </div>

      <StripeConnectButton isOnboarded={isOnboarded} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Earned"
          value={formatCurrency(summary.totalEarned)}
          description="Gross earnings to date"
          icon={DollarSign}
        />
        <StatCard
          title="In Escrow"
          value={formatCurrency(summary.inEscrow)}
          description="Held until contract release"
          icon={Lock}
        />
        <StatCard
          title="Pending"
          value={formatCurrency(summary.pending)}
          description="Processing to your account"
          icon={Clock}
        />
        <StatCard
          title="Paid Out"
          value={formatCurrency(summary.paidOut)}
          description="Released to your bank"
          icon={Wallet}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-[#404145]">
            Payment history
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-[#e8faf1]">
                <CreditCard className="size-6 text-[#1dbf73]" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-[#404145]">
                No payments yet
              </h3>
              <p className="mt-1 max-w-sm text-sm text-[#62646a]">
                Once you complete contracts, your payments and payouts will show
                up here.
              </p>
              <Link
                href="/contractor/jobs"
                className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-[#1dbf73] px-4 text-sm font-medium text-white transition-colors hover:bg-[#19a463]"
              >
                Browse jobs
              </Link>
            </div>
          ) : (
            <div className="flex flex-col">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between border-b border-[#f1f3f5] py-3 last:border-0"
                >
                  <div className="min-w-0 flex-1 pr-4">
                    <p className="truncate font-medium text-[#404145]">
                      {p.contracts?.title ?? 'Payment'}
                    </p>
                    <p className="mt-0.5 text-xs text-[#62646a]">
                      {formatDate(p.created_at)}
                      {p.platform_fee > 0 ? (
                        <span className="ml-2 text-[#6b7280]">
                          Fee {formatCurrency(p.platform_fee)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    {p.invoice_url ? (
                      <a
                        href={p.invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden items-center gap-1 text-xs text-[#1dbf73] hover:text-[#19a463] sm:inline-flex"
                      >
                        <FileText className="size-3.5" />
                        Invoice
                      </a>
                    ) : null}
                    <div className="flex flex-col items-end">
                      <span className="font-semibold text-[#404145]">
                        {formatCurrency(p.net_amount ?? 0)}
                      </span>
                      <div className="mt-1">
                        <PaymentStatusBadge status={p.status} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
