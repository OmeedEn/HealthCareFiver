'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/data'
import { toast } from 'sonner'
import {
  Loader2,
  CheckCircle2,
  Eye,
  Zap,
  Briefcase,
  CalendarCheck,
  BadgeCheck,
  ShieldCheck,
} from 'lucide-react'

export type SubscribeState = 'ready' | 'not_verified'

const INCLUDED = [
  {
    icon: Eye,
    title: 'Get discovered',
    body: 'Your profile appears in search results and browse listings for facilities and clients.',
  },
  {
    icon: CalendarCheck,
    title: 'Be bookable',
    body: 'Accept bookings and contracts directly through Sanus.',
  },
  {
    icon: Briefcase,
    title: 'Apply to open positions',
    body: 'Apply to jobs posted by healthcare facilities.',
  },
  {
    icon: BadgeCheck,
    title: 'Verified professional badge',
    body: 'Show your verified status on your public profile.',
  },
]

export function SubscribeCard({ state }: { state: SubscribeState }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

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

  async function handleSignOut() {
    setSigningOut(true)
    if (!isDemoMode()) {
      const supabase = createClient()
      await supabase.auth.signOut()
    }
    router.replace('/login')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-[#e4e5e7] bg-white p-8 shadow-sm">
          {state === 'not_verified' ? (
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e8faf1]">
                <ShieldCheck className="h-7 w-7 text-[#1dbf73]" />
              </div>
              <h1 className="mt-4 text-2xl font-black tracking-tight text-[#404145]">
                Get verified first
              </h1>
              <p className="mt-2 text-sm text-[#62646a]">
                Joining and verification are free. Once your credentials are
                approved, you can activate your profile to go live.
              </p>
              <Link href="/contractor/credentials" className="mt-6 block">
                <Button className="h-12 w-full bg-[#1dbf73] text-sm font-bold text-white hover:bg-[#19a463]">
                  Go to my credentials
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e8faf1]">
                  <Zap className="h-7 w-7 text-[#1dbf73]" />
                </div>
                <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#e8faf1] px-3 py-1 text-xs font-bold text-[#0f4c3a]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#1dbf73]" />
                  You&apos;re verified
                </p>
                <h1 className="mt-3 text-2xl font-black tracking-tight text-[#404145]">
                  Go live on Sanus
                </h1>
                <p className="mt-2 text-sm text-[#62646a]">
                  Your credentials are approved. Activate your profile to
                  become visible, bookable, and able to apply to jobs.
                </p>
              </div>

              {/* What's included */}
              <ul className="mt-8 space-y-3">
                {INCLUDED.map(({ icon: Icon, title, body }) => (
                  <li key={title} className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#1dbf73]" />
                    <div>
                      <p className="text-sm font-semibold text-[#404145]">
                        {title}
                      </p>
                      <p className="text-xs text-[#95979d]">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Price + CTA */}
              <div className="mt-8 rounded-xl border border-[#e4e5e7] bg-[#fafafa] p-4 text-center">
                <p className="text-sm text-[#62646a]">Monthly subscription</p>
                <p className="mt-1 text-3xl font-black text-[#404145]">
                  $29
                  <span className="text-base font-normal text-[#95979d]">
                    /mo
                  </span>
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
                  'Activate profile — $29/mo'
                )}
              </Button>

              <p className="mt-4 text-center text-xs text-[#95979d]">
                Secure payment powered by Stripe. You can cancel at any time;
                your profile goes offline at the end of the billing period.
              </p>
            </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-4 text-xs">
          <Link
            href="/dashboard"
            className="font-semibold text-[#62646a] hover:underline"
          >
            Not now — back to dashboard
          </Link>
          <span className="text-[#c5c6c9]" aria-hidden>
            ·
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="font-semibold text-[#62646a] hover:underline disabled:opacity-60"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
