'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, CreditCard, CheckCircle } from 'lucide-react'

interface StripeConnectButtonProps {
  isOnboarded: boolean
}

export function StripeConnectButton({ isOnboarded }: StripeConnectButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleSetupPayments() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to create Stripe Connect account')
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to set up payments'
      )
    } finally {
      setLoading(false)
    }
  }

  if (isOnboarded) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <CheckCircle className="size-5 text-green-600" />
          <span className="text-sm font-medium">Payment account connected</span>
          <Badge variant="default" className="ml-auto bg-green-600">
            Payments Active
          </Badge>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="size-5" />
          Set Up Payments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Connect your bank account through Stripe to receive payments for
          completed contracts. Setup takes just a few minutes.
        </p>
        <Button onClick={handleSetupPayments} disabled={loading}>
          {loading && (
            <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
          )}
          Set Up Payments
        </Button>
      </CardContent>
    </Card>
  )
}
