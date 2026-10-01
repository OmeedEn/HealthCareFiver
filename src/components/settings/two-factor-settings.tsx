'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/data'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TotpEnrollment, mfaErrorMessage } from '@/components/auth/totp-setup'
import { toast } from 'sonner'
import { Loader2, ShieldCheck, Smartphone } from 'lucide-react'

interface VerifiedFactor {
  id: string
  name: string
  createdAt: string
}

interface FactorsResult {
  factors: VerifiedFactor[]
  error: string | null
}

async function fetchFactors(): Promise<FactorsResult> {
  const supabase = createClient()
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error || !data) {
    return {
      factors: [],
      error: 'We couldn’t load your authenticators. Refresh to try again.',
    }
  }
  return {
    error: null,
    factors: data.totp.map((f, i) => ({
      id: f.id,
      name: f.friendly_name || `Authenticator ${i + 1}`,
      createdAt: f.created_at,
    })),
  }
}

/**
 * Lists the user's verified TOTP authenticators and lets them add a backup
 * or remove one — but never the last one. Every session must stay AAL2, so
 * there is intentionally no "turn off two-factor" control here.
 */
export function TwoFactorSettings() {
  const router = useRouter()
  const demo = isDemoMode()
  const [factors, setFactors] = useState<VerifiedFactor[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const apply = useCallback((result: FactorsResult) => {
    setLoadError(result.error)
    setFactors(result.factors)
  }, [])

  const load = useCallback(async () => apply(await fetchFactors()), [apply])

  useEffect(() => {
    if (demo) return
    let cancelled = false
    fetchFactors().then((result) => {
      if (!cancelled) apply(result)
    })
    return () => {
      cancelled = true
    }
  }, [demo, apply])

  async function handleRemove(factorId: string) {
    setRemovingId(factorId)
    const supabase = createClient()

    // Re-check against the server so a stale list can never remove the
    // last remaining authenticator.
    const { data: latest } = await supabase.auth.mfa.listFactors()
    const verified = latest?.totp ?? []
    if (verified.length < 2 || !verified.some((f) => f.id === factorId)) {
      toast.error('Add another authenticator before removing this one.')
      setRemovingId(null)
      setConfirmingId(null)
      await load()
      return
    }

    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    if (error) {
      toast.error(mfaErrorMessage(error, 'Couldn’t remove that authenticator.'))
      setRemovingId(null)
      return
    }

    toast.success('Authenticator removed')
    setRemovingId(null)
    setConfirmingId(null)
    // Pick up any AAL change on the session; if it dropped, the proxy will
    // send the user to verify with a remaining authenticator.
    await supabase.auth.refreshSession()
    await load()
    router.refresh()
  }

  async function handleAdded() {
    toast.success('Authenticator added')
    setAdding(false)
    await load()
    router.refresh()
  }

  const count = factors?.length ?? 0
  const kind = count === 0 ? 'primary' : 'backup'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="size-4 text-[#1dbf73]" />
          Two-factor authentication
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-[#404145]">
          Sanus asks for a 6-digit code from an authenticator app each time you
          sign in. This is required for every account.
        </p>

        {demo ? (
          <p className="text-xs text-[#62646a]">
            Authenticator management isn’t available in demo mode.
          </p>
        ) : factors === null ? (
          <div className="flex items-center gap-2 text-xs text-[#62646a]">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading authenticators…
          </div>
        ) : (
          <>
            {loadError && (
              <p role="alert" className="text-xs text-red-600">
                {loadError}
              </p>
            )}

            {count > 0 && (
              <ul className="space-y-2">
                {factors.map((f) => {
                  const isLast = count < 2
                  const confirming = confirmingId === f.id
                  const removing = removingId === f.id
                  return (
                    <li
                      key={f.id}
                      className="flex flex-col gap-2 rounded-md border border-[#e4e5e7] bg-[#fafefb] px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <ShieldCheck
                          className="size-4 shrink-0 text-[#1dbf73]"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#404145]">
                            {f.name}
                          </p>
                          <p className="text-xs text-[#62646a]">
                            Added{' '}
                            {new Date(f.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>

                      {isLast ? (
                        <p className="text-xs text-[#95979d] sm:max-w-[14rem] sm:text-right">
                          Your only authenticator — add a backup before
                          removing it.
                        </p>
                      ) : confirming ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#62646a]">
                            Remove this authenticator?
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmingId(null)}
                            disabled={removing}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemove(f.id)}
                            disabled={removing}
                          >
                            {removing && (
                              <Loader2
                                className="mr-1 size-3.5 animate-spin"
                                aria-hidden="true"
                              />
                            )}
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmingId(f.id)}
                          disabled={removingId !== null}
                        >
                          Remove
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {adding ? (
              <div className="rounded-md border border-[#e4e5e7] p-4">
                <p className="mb-4 text-sm font-semibold text-[#404145]">
                  {kind === 'backup'
                    ? 'Add a backup authenticator'
                    : 'Set up your authenticator'}
                </p>
                <TotpEnrollment
                  kind={kind}
                  onVerified={handleAdded}
                  onCancel={() => setAdding(false)}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-md border border-dashed border-[#e4e5e7] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-[#404145]">
                    {count === 0
                      ? 'Set up an authenticator'
                      : count === 1
                        ? 'Add a backup authenticator'
                        : 'Add another authenticator'}
                  </p>
                  <p className="text-xs text-[#62646a]">
                    {count === 1
                      ? 'Recommended. Put a second authenticator on another device (like a tablet or old phone) so losing your phone doesn’t lock you out.'
                      : 'Use any authenticator app on another device.'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAdding(true)}
                  className="shrink-0"
                >
                  {count === 0 ? 'Set up' : 'Add authenticator'}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
