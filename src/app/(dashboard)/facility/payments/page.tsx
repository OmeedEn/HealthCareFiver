import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PaymentHistory } from '@/components/payments/payment-history'
import { formatCurrency } from '@/lib/utils/format'
import { DollarSign, Clock, Lock } from 'lucide-react'

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
    contractor_profiles: {
      first_name: string
      last_name: string
    } | null
  } | null
}

export default async function FacilityPaymentsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: paymentData } = await supabase
    .from('payments')
    .select(
      'id, created_at, amount, platform_fee, net_amount, status, invoice_url, contracts(title, contractor_profiles(first_name, last_name))'
    )
    .eq('payer_id', user.id)
    .order('created_at', { ascending: false })

  const payments = (paymentData ?? []) as unknown as Payment[]

  const totalSpent = payments
    .filter((p) => p.status === 'released')
    .reduce((sum, p) => sum + (p.amount ?? 0), 0)
  const pending = payments
    .filter((p) => p.status === 'pending' || p.status === 'processing')
    .reduce((sum, p) => sum + (p.amount ?? 0), 0)
  const inEscrow = payments
    .filter((p) => p.status === 'in_escrow')
    .reduce((sum, p) => sum + (p.amount ?? 0), 0)

  const formattedPayments = payments.map((p) => {
    const contractorName = p.contracts?.contractor_profiles
      ? `${p.contracts.contractor_profiles.first_name} ${p.contracts.contractor_profiles.last_name}`
      : ''
    const description = contractorName
      ? `${p.contracts?.title ?? 'Payment'} - ${contractorName}`
      : p.contracts?.title ?? 'Payment'

    return {
      id: p.id,
      created_at: p.created_at,
      description,
      amount: p.amount,
      platform_fee: p.platform_fee,
      net_amount: p.net_amount,
      status: p.status,
      invoice_url: p.invoice_url,
    }
  })

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold">Payments</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Spent
            </CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalSpent)}</p>
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
            <p className="text-2xl font-bold">{formatCurrency(pending)}</p>
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
            <p className="text-2xl font-bold">{formatCurrency(inEscrow)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentHistory payments={formattedPayments} userRole="facility" />
        </CardContent>
      </Card>
    </div>
  )
}
