'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

// Reached from the password-reset email via /callback?next=/reset-password.
// This route is deliberately NOT public: the proxy requires a session and
// passes it through the MFA gate first, so a reset link alone (an AAL1
// recovery session) can't change the password of an MFA-protected account.
export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      toast.error('Passwords don’t match.')
      return
    }

    setLoading(true)

    if (isDemoMode()) {
      toast.success('Password updated (demo mode)')
      router.push('/dashboard')
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      console.error('Password update failed:', error)
      toast.error(
        error.code === 'same_password'
          ? 'Choose a password different from your current one.'
          : error.code === 'weak_password'
            ? 'That password is too weak. Try a longer one.'
            : 'Couldn’t update your password. Request a new reset link and try again.'
      )
      setLoading(false)
      return
    }

    toast.success('Password updated')
    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight text-[#404145]">
        Set a new password
      </h1>
      <p className="mt-1.5 text-sm text-[#62646a]">
        Choose a new password for your account.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="space-y-1.5">
          <Label
            htmlFor="password"
            className="text-sm font-semibold text-[#404145]"
          >
            New password
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            maxLength={200}
            autoComplete="new-password"
            autoFocus
            className="h-11"
          />
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="confirm"
            className="text-sm font-semibold text-[#404145]"
          >
            Confirm new password
          </Label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            maxLength={200}
            autoComplete="new-password"
            className="h-11"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full bg-[#1dbf73] text-sm font-bold text-white hover:bg-[#19a463]"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Update password
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[#62646a]">
        Link expired?{' '}
        <Link
          href="/forgot-password"
          className="font-bold text-[#1dbf73] hover:underline"
        >
          Send a new one
        </Link>
      </p>
    </div>
  )
}
