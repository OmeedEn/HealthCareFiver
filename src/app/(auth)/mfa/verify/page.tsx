'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SUPPORT_EMAIL } from '@/lib/env'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CodeInput, mfaErrorMessage } from '@/components/auth/totp-setup'
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
        Open your authenticator app and enter the 6-digit code it shows for
        Sanus.
      </p>
    </div>
  )
}

interface TotpFactor {
  id: string
  name: string
}

function VerifyForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = safeRedirect(searchParams.get('redirectTo'))
  const [factors, setFactors] = useState<TotpFactor[] | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const submitting = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (cancelled) return
      const totp = (data?.totp ?? []).map((f, i) => ({
        id: f.id,
        name: f.friendly_name || `Authenticator ${i + 1}`,
      }))
      if (error || totp.length === 0) {
        setLoadError(
          'We couldn’t find an authenticator on this account. Try signing out and back in.'
        )
        setFactors([])
        return
      }
      setFactors(totp)
      setFactorId(totp[0].id)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function verify(value: string) {
    if (!factorId || submitting.current || value.length !== 6) return
    submitting.current = true
    setLoading(true)
    setCodeError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: value,
    })
    if (error) {
      const multiple = (factors?.length ?? 0) > 1
      setCodeError(
        mfaErrorMessage(
          error,
          'That code didn’t match. Try the latest one in your app.'
        ) +
          (multiple && error.code === 'mfa_verification_failed'
            ? ' Also check that the authenticator selected above is the one you’re using.'
            : '')
      )
      setCode('')
      setLoading(false)
      submitting.current = false
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  const hasBackup = (factors?.length ?? 0) > 1

  return (
    <div>
      <Header />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          verify(code)
        }}
        className="mt-8 space-y-5"
      >
        {hasBackup && factors && (
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-semibold text-[#404145]">
              Which authenticator are you using?
            </legend>
            <p className="text-xs text-[#62646a]">
              Each authenticator shows its own code, so pick the one you have
              with you.
            </p>
            <div className="space-y-1.5 pt-1">
              {factors.map((f) => (
                <label
                  key={f.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                    factorId === f.id
                      ? 'border-[#1dbf73] bg-[#e8faf1] text-[#0f8f56]'
                      : 'border-[#e4e5e7] text-[#404145] hover:bg-[#fafefb]'
                  }`}
                >
                  <input
                    type="radio"
                    name="factor"
                    value={f.id}
                    checked={factorId === f.id}
                    onChange={() => {
                      setFactorId(f.id)
                      setCodeError(null)
                    }}
                    className="accent-[#1dbf73]"
                  />
                  {f.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="code" className="text-sm font-semibold text-[#404145]">
            Authentication code
          </Label>
          <CodeInput
            id="code"
            value={code}
            onChange={(v) => {
              setCode(v)
              if (codeError) setCodeError(null)
            }}
            onComplete={verify}
            disabled={!factorId || loading}
            error={codeError ?? loadError}
            autoFocus
          />
        </div>

        <Button
          type="submit"
          disabled={!factorId || loading || code.length !== 6}
          className="h-11 w-full bg-[#1dbf73] text-sm font-bold text-white hover:bg-[#19a463]"
        >
          {(loading || factors === null) && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Verify
        </Button>
      </form>

      <LostAccessHelp hasBackup={hasBackup} />

      <MfaSignOut />
    </div>
  )
}

function LostAccessHelp({ hasBackup }: { hasBackup: boolean }) {
  return (
    <details className="mt-6 rounded-lg border border-[#e4e5e7] bg-[#fafefb] px-4 py-3 text-xs text-[#62646a]">
      <summary className="cursor-pointer text-sm font-semibold text-[#404145]">
        Lost access to your authenticator?
      </summary>
      <div className="mt-2 space-y-2 leading-relaxed">
        {hasBackup ? (
          <p>
            You have a backup authenticator on this account. Choose it in the
            list above, then enter the code from that app or device.
          </p>
        ) : (
          <p>
            If you set up a backup authenticator in Settings, open that app or
            device and enter its code above — any authenticator you’ve added
            works.
          </p>
        )}
        <p>
          New phone? If your app syncs or backs up (1Password, Authy, Google
          Authenticator with your Google account, Microsoft Authenticator with
          cloud backup), sign into the app on the new phone and your Sanus code
          will be there.
        </p>
        <p>
          Still stuck? Email{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
              'Lost access to my authenticator'
            )}`}
            className="font-semibold text-[#1dbf73] hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>{' '}
          from the email address on your account. To protect your health
          information, we’ll verify your identity before resetting two-step
          sign-in — this can take a little time.
        </p>
      </div>
    </details>
  )
}
