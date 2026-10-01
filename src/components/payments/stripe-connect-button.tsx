'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, CreditCard, CheckCircle } from 'lucide-react'

import type { ConnectReturnTarget } from '@/lib/stripe/connect'

interface StripeConnectButtonProps {
  isOnboarded: boolean
  /** Page Stripe-hosted onboarding returns to. Defaults to /contractor/payments. */
  returnTo?: ConnectReturnTarget
  /** 'card' (default) renders the full card; 'button' renders only the CTA. */
  variant?: 'card' | 'button'
  label?: string
  className?: string
}

export function StripeConnectButton({
  isOnboarded,
  returnTo = 'payments',
  variant = 'card',
  label = 'Set Up Payments',
  className,
}: StripeConnectButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleSetupPayments() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnTo }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to create Stripe Connect account')
      }

      if (!data.url) {
        throw new Error('Failed to start Stripe onboarding')
      }
      // Keep the spinner while the browser navigates to Stripe.
      window.location.href = data.url
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to set up payments'
      )
      setLoading(false)
    }
  }

  if (variant === 'button') {
    return (
      <Button
        onClick={handleSetupPayments}
        disabled={loading || isOnboarded}
        className={className}
      >
        {loading && (
          <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
        )}
        {loading ? 'Redirecting to Stripe...' : label}
      </Button>
    )
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
          {label}
        </Button>
      </CardContent>
    </Card>
  )
}
