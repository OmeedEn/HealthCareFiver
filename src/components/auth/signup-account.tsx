'use client'

import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TextField } from '@/app/onboarding/professional/ui'
import type { ActionResult, Screen } from '@/components/onboarding/question-flow'

// The account part of every signup path (Single-Question Onboarding spec),
// split into three short screens: email (with "Continue with Google" on
// top), password, then name + the path's consent checkbox(es). The last
// screen creates the account. Account fields live in memory only — never in
// sessionStorage (no password in storage).

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MIN_PASSWORD = 8

export interface AccountDraft {
  first_name: string
  last_name: string
  email: string
  password: string
}

export const EMPTY_ACCOUNT: AccountDraft = { first_name: '', last_name: '', email: '', password: '' }

/** One signup path as composed by the unified /signup flow. */
export interface SignupPathFlow {
  /** Pre-account answers loaded from sessionStorage (resume needs them). */
  hydrated: boolean
  /** Per-question analytics flow name (QuestionFlow `flowId`). */
  flowId: string
  screens: Screen[]
  /** First screen still to answer, within `screens`. */
  resumeIndex: number
  /**
   * The check-email screen once an account awaits confirmation, else null.
   * (A path's last screen creates the account and moves on by itself: to
   * this screen, or to onboarding / the dashboard.)
   */
  done: React.ReactNode | null
}

/**
 * Field errors for a failed POST /api/auth/signup: "already exists" (409)
 * belongs to the email screen, so the flow jumps back there.
 */
export function signupErrorResult(status: number, error: string): ActionResult {
  return status === 409 ? { ok: false, error, fields: { email: error } } : { ok: false, error }
}

export function accountScreens({
  id,
  title,
  sub,
  account,
  setAccount,
  emailLabel = 'Email',
  emailPlaceholder = 'you@example.com',
  emailHint,
  onGoogle,
  googleLoading,
  consentValid,
  renderConsent,
  create,
  extraWeight = 0,
}: {
  /** Id of the first (email) screen; the others are `${id}-password` and `${id}-name`. */
  id: string
  title: string
  sub?: string
  account: AccountDraft
  setAccount: (patch: Partial<AccountDraft>) => void
  emailLabel?: string
  emailPlaceholder?: string
  emailHint?: string
  onGoogle: () => void
  googleLoading: boolean
  consentValid: boolean
  renderConsent: () => React.ReactNode
  create: () => Promise<ActionResult>
  /** Progress weight for screens after the account (e.g. onboarding still to come). */
  extraWeight?: number
}): Screen[] {
  const emailOk = EMAIL_RE.test(account.email.trim())
  const pwLen = account.password.length
  return [
    {
      id,
      title,
      sub,
      fields: ['email'],
      canContinue: () => emailOk,
      render: ({ errors }) => (
        <div className="space-y-5">
          <Button
            type="button"
            variant="outline"
            onClick={onGoogle}
            disabled={googleLoading}
            className="h-14 w-full bg-white text-base font-semibold"
          >
            {googleLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <GoogleIcon />}
            Continue with Google
          </Button>
          <div className="flex items-center gap-3 text-xs text-[#95979d]">
            <div className="h-px flex-1 bg-[#e4e5e7]" />
            or continue with email
            <div className="h-px flex-1 bg-[#e4e5e7]" />
          </div>
          <TextField
            id="email"
            label={emailLabel}
            type="email"
            inputMode="email"
            value={account.email}
            onChange={(v) => setAccount({ email: v })}
            autoComplete="email"
            placeholder={emailPlaceholder}
            hint={emailHint}
            maxLength={254}
            error={errors.email}
          />
          <p className="text-center text-sm text-[#62646a]">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-[#1dbf73] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      ),
    },
    {
      id: `${id}-password`,
      title: 'Create a password',
      sub: account.email.trim() ? `For ${account.email.trim().toLowerCase()}` : undefined,
      fields: ['password'],
      canContinue: () => pwLen >= MIN_PASSWORD,
      render: ({ errors }) => (
        <>
          <TextField
            id="password"
            label="Password"
            type="password"
            value={account.password}
            onChange={(v) => setAccount({ password: v })}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            maxLength={200}
            hint={
              pwLen > 0 && pwLen < MIN_PASSWORD
                ? `At least 8 characters (${pwLen}/8).`
                : 'At least 8 characters.'
            }
            error={errors.password}
          />
          {/* Lets password managers save the email with the new password.
              After the password field so QuestionFlow focuses the password. */}
          <input
            type="email"
            name="username"
            autoComplete="username"
            value={account.email.trim()}
            readOnly
            tabIndex={-1}
            aria-hidden
            className="sr-only"
          />
        </>
      ),
    },
    {
      id: `${id}-name`,
      title: 'What’s your name?',
      fields: ['first_name', 'last_name'],
      weight: 1 + extraWeight,
      continueLabel: 'Create account',
      canContinue: () => !!account.first_name.trim() && !!account.last_name.trim() && consentValid,
      save: create,
      render: ({ errors }) => (
        <>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              id="first_name"
              label="First name"
              value={account.first_name}
              onChange={(v) => setAccount({ first_name: v })}
              autoComplete="given-name"
              maxLength={100}
              error={errors.first_name}
            />
            <TextField
              id="last_name"
              label="Last name"
              value={account.last_name}
              onChange={(v) => setAccount({ last_name: v })}
              autoComplete="family-name"
              maxLength={100}
              error={errors.last_name}
            />
          </div>
          <div className="space-y-3">{renderConsent()}</div>
        </>
      ),
    },
  ]
}

/** Redirect target after Google sign-in, through /callback (PKCE exchange). */
export function googleRedirectTo(next: string): string {
  const origin = (process.env.NEXT_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '')
  return `${origin}/callback?next=${encodeURIComponent(next)}`
}

export function GoogleIcon() {
  return (
    <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}
