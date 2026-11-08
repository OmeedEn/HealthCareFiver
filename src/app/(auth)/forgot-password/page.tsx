'use client'

import { useState } from 'react'
import Link from 'next/link'
import { isDemoMode } from '@/lib/demo/data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    if (isDemoMode()) {
      toast.success('Password reset email sent (demo mode)')
      setSent(true)
      setLoading(false)
      return
    }

    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
    } catch (err) {
      // Treat network errors as success too — never reveal account existence.
      console.error('Forgot-password request failed:', err)
    }

    setSent(true)
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#eceefe]">
          <CheckCircle2 className="h-8 w-8 text-[#2f3cf5]" />
        </div>
        <h2 className="mt-4 text-xl font-black text-[#1a1a17]">
          Check your email
        </h2>
        <p className="mt-2 text-sm text-[#5f5d57]">
          If an account exists for <strong>{email}</strong>, we&apos;ve sent
          password reset instructions.
        </p>
        <Link href="/login">
          <Button
            variant="outline"
            className="mt-6 h-11 w-full font-semibold"
          >
            Back to Sign In
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div>
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5f5d57] hover:text-[#1a1a17]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Sign In
      </Link>

      <h1 className="mt-4 text-2xl font-black tracking-tight text-[#1a1a17]">
        Reset your password
      </h1>
      <p className="mt-1.5 text-sm text-[#5f5d57]">
        Enter your email and we&apos;ll send you a link to reset your password
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-semibold text-[#1a1a17]">
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

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full bg-[#2f3cf5] text-sm font-bold text-white hover:bg-[#2330c8]"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send Reset Link
        </Button>
      </form>

      <Separator className="my-6" />

      <p className="text-center text-sm text-[#5f5d57]">
        Remember your password?{' '}
        <Link
          href="/login"
          className="font-bold text-[#2f3cf5] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
