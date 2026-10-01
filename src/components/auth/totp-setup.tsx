'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SUPPORT_EMAIL } from '@/lib/env'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, Copy, ExternalLink, Loader2, Smartphone } from 'lucide-react'

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export type FactorKind = 'primary' | 'backup'

/**
 * Human-readable factor name, e.g. "Authenticator · Sep 30, 2026".
 * Supabase requires friendly names to be unique per user, so a numeric
 * suffix is added if the name is already taken.
 */
export function friendlyFactorName(
  kind: FactorKind,
  existingNames: (string | undefined)[]
): string {
  const date = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const label = kind === 'backup' ? 'Backup authenticator' : 'Authenticator'
  const base = `${label} · ${date}`
  const taken = new Set(existingNames.filter(Boolean))
  if (!taken.has(base)) return base
  for (let i = 2; ; i++) {
    const candidate = `${base} (${i})`
    if (!taken.has(candidate)) return candidate
  }
}

/** "JBSWY3DPEHPK3PXP" -> "JBSW Y3DP EHPK 3PXP" */
export function formatSecret(secret: string): string {
  const clean = secret.replace(/\s+/g, '')
  return clean.match(/.{1,4}/g)?.join(' ') ?? clean
}

/** Plain-language message for a Supabase MFA error. */
export function mfaErrorMessage(
  error: { code?: string | null; message?: string } | null | undefined,
  fallback: string
): string {
  switch (error?.code) {
    case 'mfa_verification_failed':
      return 'That code didn’t match. Codes change every 30 seconds — enter the one showing in your app right now. If it keeps failing, make sure your phone’s clock is set automatically.'
    case 'mfa_challenge_expired':
      return 'That took a little too long. Enter the newest code from your app.'
    case 'over_request_rate_limit':
      return 'Too many attempts. Please wait a minute, then try again.'
    case 'too_many_enrolled_mfa_factors':
      return 'You’ve reached the maximum number of authenticators. Remove one before adding another.'
    case 'mfa_factor_name_conflict':
      return 'An authenticator with that name already exists. Please try again.'
    case 'insufficient_aal':
      return 'For your security, sign out and sign back in (including the code step) before changing authenticators.'
    case 'mfa_totp_enroll_not_enabled':
    case 'mfa_totp_verify_not_enabled':
      return `Two-factor setup is temporarily unavailable. Please contact ${SUPPORT_EMAIL}.`
    default:
      return fallback
  }
}

/* -------------------------------------------------------------------------- */
/* Authenticator app recommendations                                          */
/* -------------------------------------------------------------------------- */

const AUTHENTICATOR_APPS: {
  name: string
  links: { label: string; href: string }[]
}[] = [
  {
    name: 'Google Authenticator',
    links: [
      {
        label: 'iPhone',
        href: 'https://apps.apple.com/app/google-authenticator/id388497605',
      },
      {
        label: 'Android',
        href: 'https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2',
      },
    ],
  },
  {
    name: 'Microsoft Authenticator',
    links: [
      {
        label: 'iPhone',
        href: 'https://apps.apple.com/app/microsoft-authenticator/id983156458',
      },
      {
        label: 'Android',
        href: 'https://play.google.com/store/apps/details?id=com.azure.authenticator',
      },
    ],
  },
  {
    name: '1Password',
    links: [{ label: 'Download', href: 'https://1password.com/downloads' }],
  },
  {
    name: 'Authy',
    links: [{ label: 'Download', href: 'https://authy.com/download/' }],
  },
]

export function AuthenticatorAppLinks() {
  return (
    <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
      {AUTHENTICATOR_APPS.map((app) => (
        <li
          key={app.name}
          className="rounded-md border border-[#e4e5e7] bg-white px-3 py-2"
        >
          <p className="text-xs font-semibold text-[#404145]">{app.name}</p>
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs">
            {app.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 font-semibold text-[#1dbf73] hover:underline"
              >
                {link.label}
                <ExternalLink className="size-3" aria-hidden="true" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ))}
          </p>
        </li>
      ))}
    </ul>
  )
}

/* -------------------------------------------------------------------------- */
/* Secret key with copy button                                                */
/* -------------------------------------------------------------------------- */

export function SecretKey({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false)
  const formatted = formatSecret(secret)

  async function copy() {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked (e.g. insecure context); the key is
      // selectable so the user can still copy it by hand.
      setCopied(false)
    }
  }

  return (
    <div className="mt-2">
      <p className="text-xs text-[#62646a]">
        Setup key (choose “Enter a setup key” in your app, time-based):
      </p>
      <div className="mt-1 flex items-stretch gap-2">
        <code
          aria-label="Setup key"
          className="flex-1 select-all break-all rounded-md border border-[#e4e5e7] bg-[#f5f5f5] px-3 py-2 font-mono text-sm tracking-wider text-[#404145]"
        >
          {formatted}
        </code>
        <Button
          type="button"
          variant="outline"
          onClick={copy}
          className="h-auto shrink-0 px-3 text-xs font-semibold"
        >
          {copied ? (
            <Check className="mr-1 size-3.5 text-[#1dbf73]" aria-hidden="true" />
          ) : (
            <Copy className="mr-1 size-3.5" aria-hidden="true" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Setup key copied to clipboard' : ''}
      </span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* 6-digit code input                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Digits-only code field. Calls `onComplete` as soon as six digits are
 * present, whether typed, pasted ("123 456" works) or autofilled.
 */
export function CodeInput({
  id,
  value,
  onChange,
  onComplete,
  disabled,
  error,
  autoFocus,
}: {
  id: string
  value: string
  onChange: (code: string) => void
  onComplete: (code: string) => void
  disabled?: boolean
  error?: string | null
  autoFocus?: boolean
}) {
  const errorId = `${id}-error`

  function accept(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 6)
    onChange(digits)
    if (digits.length === 6) onComplete(digits)
  }

  return (
    <div className="space-y-1.5">
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        placeholder="123456"
        value={value}
        onChange={(e) => accept(e.target.value)}
        onPaste={(e) => {
          e.preventDefault()
          accept(e.clipboardData.getData('text'))
        }}
        required
        disabled={disabled}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="h-11 text-center font-mono text-lg tracking-[0.4em]"
      />
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Full enrollment flow                                                       */
/* -------------------------------------------------------------------------- */

interface Enrollment {
  factorId: string
  qrCode: string
  secret: string
  uri: string
}

/**
 * Enrolls a new TOTP factor and verifies it. Used both for the required
 * first authenticator (/mfa/enroll) and for adding a backup in Settings.
 */
export function TotpEnrollment({
  kind,
  onVerified,
  onCancel,
}: {
  kind: FactorKind
  onVerified: () => void
  /** When set, a Cancel button removes the pending (unverified) factor. */
  onCancel?: () => void
}) {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const started = useRef(false)
  const submitting = useRef(false)

  const start = useCallback(async () => {
    setStartError(null)
    const supabase = createClient()

    // Clear any half-finished TOTP factors from an abandoned attempt so the
    // user isn't blocked by the factor limit or a stale friendly name.
    const { data: factors } = await supabase.auth.mfa.listFactors()
    for (const f of factors?.all ?? []) {
      if (f.factor_type === 'totp' && f.status === 'unverified') {
        await supabase.auth.mfa.unenroll({ factorId: f.id })
      }
    }
    const names = (factors?.all ?? [])
      .filter((f) => f.status === 'verified')
      .map((f) => f.friendly_name)

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: friendlyFactorName(kind, names),
    })
    if (error || !data) {
      setStartError(
        mfaErrorMessage(error, 'We couldn’t start setup. Please try again.')
      )
      return
    }
    setEnrollment({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    })
  }, [kind])

  useEffect(() => {
    // Strict mode double-invokes effects; only enroll once.
    if (started.current) return
    started.current = true
    start()
  }, [start])

  async function verify(value: string) {
    if (!enrollment || submitting.current || value.length !== 6) return
    submitting.current = true
    setVerifying(true)
    setCodeError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollment.factorId,
      code: value,
    })
    if (error) {
      setCodeError(
        mfaErrorMessage(error, 'That code didn’t match. Check your app and try again.')
      )
      setCode('')
      setVerifying(false)
      submitting.current = false
      return
    }
    onVerified()
  }

  async function cancel() {
    if (enrollment) {
      const supabase = createClient()
      await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId })
    }
    onCancel?.()
  }

  const stepNumber =
    'flex size-6 shrink-0 items-center justify-center rounded-full bg-[#e8faf1] text-xs font-bold text-[#0f8f56]'

  return (
    <ol className="space-y-6">
      {/* Step 1 — get an app */}
      <li className="flex gap-3">
        <span className={stepNumber}>1</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#404145]">
            Get a free authenticator app
          </p>
          <p className="mt-0.5 text-xs text-[#62646a]">
            An authenticator app shows a new 6-digit code every 30 seconds.
            Already have one? Skip to step 2. Any of these work:
          </p>
          <AuthenticatorAppLinks />
        </div>
      </li>

      {/* Step 2 — add Sanus to the app */}
      <li className="flex gap-3">
        <span className={stepNumber}>2</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#404145]">
            Add Sanus to the app
          </p>

          {startError ? (
            <div
              role="alert"
              className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              {startError}{' '}
              <button
                type="button"
                onClick={start}
                className="font-bold underline"
              >
                Try again
              </button>
            </div>
          ) : !enrollment ? (
            <div className="mt-3 flex items-center gap-2 text-xs text-[#62646a]">
              <Loader2 className="size-4 animate-spin text-[#95979d]" />
              Preparing your setup key…
            </div>
          ) : (
            <>
              {/* Phones: one tap opens the authenticator app directly. */}
              <div className="sm:hidden">
                <p className="mt-0.5 text-xs text-[#62646a]">
                  Tap the button to add Sanus to your authenticator app on
                  this phone, then come back here.
                </p>
                <a
                  href={enrollment.uri}
                  className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#1dbf73] text-sm font-bold text-white hover:bg-[#19a463]"
                >
                  <Smartphone className="size-4" aria-hidden="true" />
                  Open in authenticator app
                </a>
                <p className="mt-2 text-xs text-[#95979d]">
                  Nothing happened? Install an app from step 1 first, or copy
                  the setup key below into it.
                </p>
                <SecretKey secret={enrollment.secret} />
                <details className="mt-2 text-xs text-[#62646a]">
                  <summary className="cursor-pointer font-semibold text-[#1dbf73]">
                    Using a different device? Show QR code
                  </summary>
                  <QrCode src={enrollment.qrCode} />
                </details>
              </div>

              {/* Larger screens: scan the QR with a phone. */}
              <div className="hidden sm:block">
                <p className="mt-0.5 text-xs text-[#62646a]">
                  In the app, tap <strong>+</strong> (or “Add account”) and
                  scan this QR code with your phone’s camera.
                </p>
                <QrCode src={enrollment.qrCode} />
                <details className="mt-2 text-xs text-[#62646a]">
                  <summary className="cursor-pointer font-semibold text-[#1dbf73]">
                    Can’t scan? Enter a setup key or open the app on this
                    device
                  </summary>
                  <SecretKey secret={enrollment.secret} />
                  <a
                    href={enrollment.uri}
                    className="mt-2 inline-flex items-center gap-1 font-semibold text-[#1dbf73] hover:underline"
                  >
                    <Smartphone className="size-3.5" aria-hidden="true" />
                    Open in authenticator app on this device
                  </a>
                </details>
              </div>
            </>
          )}
        </div>
      </li>

      {/* Step 3 — confirm a code */}
      <li className="flex gap-3">
        <span className={stepNumber}>3</span>
        <form
          className="min-w-0 flex-1 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            verify(code)
          }}
        >
          <Label
            htmlFor={`totp-code-${kind}`}
            className="text-sm font-semibold text-[#404145]"
          >
            Enter the 6-digit code the app shows for Sanus
          </Label>
          <CodeInput
            id={`totp-code-${kind}`}
            value={code}
            onChange={(v) => {
              setCode(v)
              if (codeError) setCodeError(null)
            }}
            onComplete={verify}
            disabled={!enrollment || verifying}
            error={codeError}
          />
          <div className="flex gap-2">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={cancel}
                disabled={verifying}
                className="h-11 flex-1 text-sm font-semibold"
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={!enrollment || verifying || code.length !== 6}
              className="h-11 flex-1 bg-[#1dbf73] text-sm font-bold text-white hover:bg-[#19a463]"
            >
              {verifying && <Loader2 className="mr-2 size-4 animate-spin" />}
              Verify and continue
            </Button>
          </div>
        </form>
      </li>
    </ol>
  )
}

function QrCode({ src }: { src: string }) {
  return (
    <div className="mt-3 flex size-48 items-center justify-center rounded-lg border border-[#e4e5e7] bg-white p-2">
      {/* qr_code is an SVG data URI generated by Supabase */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Authenticator QR code" className="size-full" />
    </div>
  )
}
