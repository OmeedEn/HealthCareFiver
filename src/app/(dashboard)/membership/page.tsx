'use client'

import { useState } from 'react'
import { isDemoMode, DEMO_MEMBERSHIP } from '@/lib/demo/data'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Check, Crown, Sparkles } from 'lucide-react'

export default function MembershipPage() {
  const [currentPlan] = useState(DEMO_MEMBERSHIP.currentPlan)
  const plans = DEMO_MEMBERSHIP.plans

  function handleUpgrade(planName: string) {
    if (isDemoMode()) {
      toast.success(`Upgrade to ${planName} initiated (demo mode)`)
      return
    }
    // In production: would call Stripe checkout session
    toast.info('Redirecting to checkout...')
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#111827]">
          Membership Plans
        </h1>
        <p className="mt-1 text-[#6b7280]">
          Choose the plan that fits your needs. Upgrade anytime.
        </p>
      </div>

      {/* Current plan status */}
      <Card className="border-[#1dbf73]/20 bg-[#e8faf1]">
        <CardContent className="flex items-center gap-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1dbf73]/20">
            <Crown className="h-5 w-5 text-[#1dbf73]" />
          </div>
          <div>
            <p className="text-sm text-[#6b7280]">Current Plan</p>
            <p className="text-lg font-semibold text-[#111827]">
              Basic &mdash; Free
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Plan cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlan
          const isPopular = 'popular' in plan && plan.popular

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${
                isPopular
                  ? 'border-2 border-[#1dbf73] shadow-lg'
                  : isCurrent
                    ? 'border-2 border-[#374151]'
                    : 'border border-[#e4e5e7]'
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-[#1dbf73] text-white hover:bg-[#1dbf73]/90">
                    <Sparkles className="mr-1 h-3 w-3" />
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="pb-4 pt-6">
                <CardTitle className="font-heading text-xl text-[#111827]">
                  {plan.name}
                </CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-[#111827]">
                    {plan.price === 0 ? 'Free' : `$${plan.price}`}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-sm text-[#6b7280]">
                      /{plan.interval}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col gap-6">
                <ul className="flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1dbf73]" />
                      <span className="text-sm text-[#374151]">{feature}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <Button
                    variant="outline"
                    className="w-full border-[#374151] text-[#374151]"
                    disabled
                  >
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    className={`w-full ${
                      isPopular
                        ? 'bg-[#1dbf73] text-white hover:bg-[#1dbf73]/90'
                        : 'bg-[#374151] text-white hover:bg-[#374151]/90'
                    }`}
                    onClick={() => handleUpgrade(plan.name)}
                  >
                    Upgrade to {plan.name}
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* FAQ / Info */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg text-[#111827]">
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="font-medium text-[#111827]">
              Can I cancel anytime?
            </p>
            <p className="text-sm text-[#6b7280]">
              Yes. You can downgrade or cancel your plan at any time. Changes
              take effect at the end of your current billing period.
            </p>
          </div>
          <div>
            <p className="font-medium text-[#111827]">
              Is there a free trial for paid plans?
            </p>
            <p className="text-sm text-[#6b7280]">
              Professional and Enterprise plans include a 14-day free trial.
              No credit card required to start.
            </p>
          </div>
          <div>
            <p className="font-medium text-[#111827]">
              What payment methods do you accept?
            </p>
            <p className="text-sm text-[#6b7280]">
              We accept all major credit cards, debit cards, and ACH bank
              transfers through our secure payment partner Stripe.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
