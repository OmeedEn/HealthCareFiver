'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, Shield, Eye, Zap } from 'lucide-react'

export default function SubscribePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSubscribe() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/create-checkout', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Something went wrong')
        setLoading(false)
        return
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url
    } catch {
      toast.error('Failed to start checkout')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-[#e4e5e7] bg-white p-8 shadow-sm">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e8faf1]">
              <Zap className="h-7 w-7 text-[#1dbf73]" />
            </div>
            <h1 className="mt-4 text-2xl font-black tracking-tight text-[#404145]">
              Activate Your Profile
            </h1>
            <p className="mt-2 text-sm text-[#62646a]">
              Subscribe to make your profile visible to facilities looking
              for healthcare professionals like you.
            </p>
          </div>

          {/* Benefits */}
          <ul className="mt-8 space-y-3">
            <li className="flex items-start gap-3">
              <Eye className="mt-0.5 h-5 w-5 shrink-0 text-[#1dbf73]" />
              <div>
                <p className="text-sm font-semibold text-[#404145]">
                  Get discovered by facilities
                </p>
                <p className="text-xs text-[#95979d]">
                  Your profile appears in search results and browse listings
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#1dbf73]" />
              <div>
                <p className="text-sm font-semibold text-[#404145]">
                  Apply to open positions
                </p>
                <p className="text-xs text-[#95979d]">
                  Browse and apply to jobs posted by healthcare facilities
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 shrink-0 text-[#1dbf73]" />
              <div>
                <p className="text-sm font-semibold text-[#404145]">
                  Verified professional badge
                </p>
                <p className="text-xs text-[#95979d]">
                  Stand out with a verified status on your profile
                </p>
              </div>
            </li>
          </ul>

          {/* Price + CTA */}
          <div className="mt-8 rounded-xl border border-[#e4e5e7] bg-[#fafafa] p-4 text-center">
            <p className="text-sm text-[#62646a]">Monthly subscription</p>
            <p className="mt-1 text-3xl font-black text-[#404145]">
              $29<span className="text-base font-normal text-[#95979d]">/mo</span>
            </p>
            <p className="mt-1 text-xs text-[#95979d]">Cancel anytime</p>
          </div>

          <Button
            onClick={handleSubscribe}
            disabled={loading}
            className="mt-6 h-12 w-full bg-[#1dbf73] text-sm font-bold text-white hover:bg-[#19a463]"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting to checkout...
              </>
            ) : (
              'Subscribe & Activate Profile'
            )}
          </Button>

          <p className="mt-4 text-center text-xs text-[#95979d]">
            Secure payment powered by Stripe. You can cancel or change
            your plan at any time from your account settings.
          </p>
        </div>

        {/* Sign out link */}
        <p className="mt-6 text-center text-xs text-[#95979d]">
          Not ready yet?{' '}
          <button
            onClick={() => router.push('/login')}
            className="font-semibold text-[#62646a] hover:underline"
          >
            Sign out
          </button>
        </p>
      </div>
    </div>
  )
}
