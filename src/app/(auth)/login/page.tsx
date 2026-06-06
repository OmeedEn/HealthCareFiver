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
import { Loader2 } from 'lucide-react'

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
        Sign in to your HealthGig account to continue
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)

    if (isDemoMode()) {
      toast.success('Welcome to HealthGig demo!')
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
        Sign in to your HealthGig account to continue
      </p>

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
