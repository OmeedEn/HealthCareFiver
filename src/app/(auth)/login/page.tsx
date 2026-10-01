'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { isDemoMode } from '@/lib/demo/data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Loader2, MailWarning } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Only allow internal-path redirects to avoid an open redirect via `?redirectTo=`
function safeRedirect(target: string | null): string {
  if (!target) return '/dashboard'
  if (!target.startsWith('/') || target.startsWith('//')) return '/dashboard'
  return target
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm />
    </Suspense>
  )
}

function LoginFormFallback() {
  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight text-[#404145]">
        Welcome back
      </h1>
      <p className="mt-1.5 text-sm text-[#62646a]">
        Sign in to your Sanus account to continue
      </p>
    </div>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = safeRedirect(searchParams.get('redirectTo'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  // Set to the email that tried to sign in before confirming it.
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  async function handleResend() {
    if (!unconfirmedEmail || resending) return
    setResending(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: unconfirmedEmail,
    })
    setResending(false)
    if (error) {
      toast.error(
        error.status === 429
          ? 'Please wait a minute before requesting another email.'
          : 'Couldn’t resend the email — please try again.'
      )
      return
    }
    toast.success('Confirmation email sent. Check your inbox and spam folder.')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setUnconfirmedEmail(null)

    if (isDemoMode()) {
      toast.success('Welcome to Sanus demo!')
      router.push(redirectTo)
      return
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (body.code === 'email_not_confirmed') {
          setUnconfirmedEmail(email.trim().toLowerCase())
          setLoading(false)
          return
        }
        toast.error(body.error || 'Could not sign in')
        setLoading(false)
        return
      }
    } catch {
      toast.error('Network error — please try again')
      setLoading(false)
      return
    }

    toast.success('Signed in successfully')
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight text-[#404145]">
        Welcome back
      </h1>
      <p className="mt-1.5 text-sm text-[#62646a]">
        Sign in to your Sanus account to continue
      </p>

      {unconfirmedEmail && (
        <div
          role="alert"
          className="mt-6 flex gap-3 rounded-lg border border-[#f5d68a] bg-[#fffaeb] p-4"
        >
          <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-[#b7791f]" />
          <div className="text-sm text-[#404145]">
            <p className="font-semibold">Your account isn&apos;t confirmed yet</p>
            <p className="mt-1 text-[#62646a]">
              We sent a confirmation link to{' '}
              <span className="font-medium text-[#404145]">{unconfirmedEmail}</span>.
              Click it to activate your account, then sign in. Don&apos;t see
              it? Check your spam or junk folder.
            </p>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="mt-2 inline-flex items-center font-semibold text-[#1dbf73] hover:underline disabled:opacity-60"
            >
              {resending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Resend confirmation email
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-semibold text-[#404145]">
            Email address
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="h-11"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-semibold text-[#404145]">
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-[#1dbf73] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="h-11"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full bg-[#1dbf73] text-sm font-bold text-white hover:bg-[#19a463]"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign In
        </Button>
      </form>

      <Separator className="my-6" />

      <p className="text-center text-sm text-[#62646a]">
        Don&apos;t have an account?{' '}
        <Link
          href="/signup"
          className="font-bold text-[#1dbf73] hover:underline"
        >
          Create one free
        </Link>
      </p>
    </div>
  )
}
