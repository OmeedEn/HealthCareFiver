'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { MfaSignOut, safeRedirect } from '../shared'

export default function MfaVerifyPage() {
  return (
    <Suspense fallback={<Header />}>
      <VerifyForm />
    </Suspense>
  )
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight text-[#404145]">
        Two-factor verification
      </h1>
      <p className="mt-1.5 text-sm text-[#62646a]">
        Enter the 6-digit code from your authenticator app.
      </p>
    </div>
  )
}

function VerifyForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = safeRedirect(searchParams.get('redirectTo'))
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)

    const supabase = createClient()
    const { data: factors, error: listError } =
      await supabase.auth.mfa.listFactors()
    const factor = factors?.totp[0]
    if (listError || !factor) {
      toast.error('No authenticator found on this account')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code: code.trim(),
    })
    if (error) {
      toast.error('That code didn’t match. Try the latest one in your app.')
      setCode('')
      setLoading(false)
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  return (
    <div>
      <Header />

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="code" className="text-sm font-semibold text-[#404145]">
            Authentication code
          </Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
            autoFocus
            className="h-11 tracking-[0.3em]"
          />
        </div>

        <Button
          type="submit"
          disabled={loading || code.length !== 6}
          className="h-11 w-full bg-[#1dbf73] text-sm font-bold text-white hover:bg-[#19a463]"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Verify
        </Button>
      </form>

      <p className="mt-4 text-xs text-[#95979d]">
        Lost access to your authenticator? Contact support to reset
        two-factor authentication on your account.
      </p>

      <MfaSignOut />
    </div>
  )
}
