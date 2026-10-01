'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { KeyRound, Loader2, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PRIVACY_PATH, TERMS_PATH } from '@/lib/legal'

/** Shape returned by POST /api/auth/signup on success. */
export interface SignupResponse {
  success?: boolean
  needsEmailConfirmation?: boolean
  error?: string
}

/**
 * Required consent checkbox. Links open in a new tab so the half-filled
 * form isn't lost.
 */
export function TermsConsent({
  checked,
  onChange,
  id = 'accept-terms',
}: {
  checked: boolean
  onChange: (v: boolean) => void
  id?: string
}) {
  return (
    <div className="mt-4 flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-[#c5c6c9] accent-[#1dbf73]"
      />
      <label htmlFor={id} className="cursor-pointer text-xs leading-5 text-[#62646a]">
        I agree to the{' '}
        <a
          href={TERMS_PATH}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline hover:text-[#404145]"
        >
          Terms of Service
        </a>{' '}
        and{' '}
        <a
          href={PRIVACY_PATH}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline hover:text-[#404145]"
        >
          Privacy Policy
        </a>
        .
      </label>
    </div>
  )
}

/** "Next you'll set up 2FA" callout shown on every post-signup screen. */
export function TwoFactorNotice({ afterConfirm = false }: { afterConfirm?: boolean }) {
  return (
    <div className="rounded-xl border border-[#bcebd5] bg-[#e8faf1] p-4 text-left">
      <div className="flex gap-3">
        <KeyRound className="mt-0.5 size-5 shrink-0 text-[#0f8f56]" />
        <p className="text-xs text-[#0f8f56]">
          {afterConfirm ? 'After you confirm your email, you' : 'Next, you'}
          &apos;ll set up two-factor authentication with an authenticator app
          (like Google Authenticator, 1Password, or Authy). It&apos;s required
          for every account because Sanus handles health information.
        </p>
      </div>
    </div>
  )
}

/**
 * Shown instead of the "you're in" screen when Supabase requires the user to
 * confirm their email before a session exists.
 */
export function CheckEmailStep({
  email,
  onStartOver,
}: {
  email: string
  onStartOver: () => void
}) {
  const [sending, setSending] = useState(false)

  async function resend() {
    if (sending) return
    setSending(true)
    try {
      const res = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error || 'Too many requests. Please wait and try again.')
        return
      }
      // Neutral message: the API never reveals whether the address exists.
      toast.success('If that address needs confirming, we’ve sent a new email.')
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mt-6 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#e8faf1]">
        <MailCheck className="size-8 text-[#1dbf73]" />
      </div>
      <h2 className="mt-4 text-2xl font-bold text-[#404145]">Check your email</h2>
      <p className="mt-2 text-sm text-[#62646a]">
        We sent a confirmation link to{' '}
        <strong className="break-all text-[#404145]">{email}</strong>. Open it in
        this browser to activate your account — your answers are already
        saved.
      </p>
      <p className="mt-2 text-xs text-[#62646a]">
        It can take a minute or two to arrive. Check your spam or promotions
        folder if you don&apos;t see it.
      </p>

      <div className="mt-6">
        <TwoFactorNotice afterConfirm />
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={resend}
        disabled={sending}
        className="mt-6 h-11 w-full font-semibold"
      >
        {sending && <Loader2 className="mr-2 size-4 animate-spin" />}
        Resend email
      </Button>
      <p className="mt-4 text-xs text-[#62646a]">
        Wrong email?{' '}
        <button
          type="button"
          onClick={onStartOver}
          className="font-semibold text-[#1dbf73] hover:underline"
        >
          Start over
        </button>
      </p>
    </div>
  )
}
