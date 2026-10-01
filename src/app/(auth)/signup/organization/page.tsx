'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { isDemoMode } from '@/lib/demo/data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { US_STATES } from '@/lib/utils/constants'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { TERMS_VERSION } from '@/lib/legal'
import {
  ORG_NEEDS as NEEDS,
  ORG_SIZES,
  ORG_TYPES,
} from '@/lib/onboarding/organization'
import {
  CheckEmailStep,
  TermsConsent,
  TwoFactorNotice,
  type SignupResponse,
} from '@/components/auth/signup-shared'
import { Loader2, ArrowLeft, ArrowRight, Check } from 'lucide-react'

type Step = 1 | 2 | 3 | 4

// The account is created on step 3 (after needs) so size, needs and the
// "something else" text are sent in the same signup request. facility_profiles
// has no columns for them, so they live in auth user metadata (`org_type`,
// `org_size`, `org_needs`, `org_other_need`) — see lib/onboarding/organization.

export default function OrganizationSignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)

  // Step 1
  const [contactFirst, setContactFirst] = useState('')
  const [contactLast, setContactLast] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Step 2
  const [orgName, setOrgName] = useState('')
  const [orgType, setOrgType] = useState('')
  const [orgSize, setOrgSize] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zipCode, setZipCode] = useState('')

  // Step 3
  const [needs, setNeeds] = useState<Set<string>>(new Set())
  const [otherNeed, setOtherNeed] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  // Step 4 — set when Supabase requires email confirmation (no session yet)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  const canStep1 =
    !!contactFirst.trim() &&
    !!contactLast.trim() &&
    !!email.trim() &&
    password.length >= 8 &&
    password === confirmPassword
  const canStep2 =
    !!orgName.trim() &&
    !!orgType &&
    !!orgSize &&
    !!city.trim() &&
    !!state &&
    /^\d{5}$/.test(zipCode.trim())
  const canStep3 =
    canStep1 &&
    canStep2 &&
    (needs.size > 0 || otherNeed.trim().length > 0) &&
    acceptedTerms

  function toggleNeed(key: string) {
    setNeeds((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function startOver() {
    setNeedsConfirmation(false)
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setAcceptedTerms(false)
    setStep(1)
  }

  async function submitSignup() {
    if (!canStep3 || loading) return
    setLoading(true)
    if (isDemoMode()) {
      setStep(4)
      setLoading(false)
      return
    }
    try {
      const chosen = ORG_TYPES.find((t) => t.value === orgType)
      const other = otherNeed.trim()
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'facility',
          email: email.trim().toLowerCase(),
          password,
          facility_name: orgName.trim(),
          facility_type: chosen?.enumValue ?? 'other',
          contact_name: `${contactFirst.trim()} ${contactLast.trim()}`.trim(),
          city: city.trim(),
          state,
          zip_code: zipCode.trim(),
          ...(chosen ? { org_type: chosen.value } : {}),
          org_size: orgSize,
          org_needs: Array.from(needs),
          ...(other ? { org_other_need: other } : {}),
          accepted_terms: true,
          terms_version: TERMS_VERSION,
        }),
      })
      const body: SignupResponse = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error || 'Could not create account')
        return
      }
      setNeedsConfirmation(Boolean(body.needsEmailConfirmation))
      setStep(4)
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {step < 4 && (
        <Link
          href="/signup"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#62646a] hover:text-[#404145]"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Link>
      )}

      <Progress step={step} total={4} />

      {step === 1 && (
        <div className="mt-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#404145]">
            Hire health expertise for your organization
          </h1>
          <p className="mt-1.5 text-sm text-[#62646a]">
            Start with your contact details. Next we&apos;ll get your
            organization details.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Field label="Contact first name" id="cfn" value={contactFirst} onChange={setContactFirst} autoComplete="given-name" />
            <Field label="Contact last name" id="cln" value={contactLast} onChange={setContactLast} autoComplete="family-name" />
          </div>
          <div className="mt-3">
            <Field label="Work email address" id="email" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@company.com" />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Password" id="pw" type="password" value={password} onChange={setPassword} autoComplete="new-password" placeholder="Min 8 characters" />
            <Field label="Confirm password" id="pw2" type="password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" placeholder="Repeat password" />
          </div>
          {password.length > 0 && password.length < 8 ? (
            <p className="mt-2 text-xs text-[#c0392b]">
              Password must be at least 8 characters ({password.length}/8).
            </p>
          ) : (
            <p className="mt-2 text-xs text-[#62646a]">
              Use at least 8 characters. A longer passphrase is stronger.
            </p>
          )}
          {confirmPassword && password !== confirmPassword && (
            <p className="mt-1 text-xs text-red-600">Passwords don&apos;t match.</p>
          )}

          <Button
            disabled={!canStep1}
            onClick={() => setStep(2)}
            className="mt-6 h-11 w-full bg-[#1dbf73] text-sm font-semibold text-white hover:bg-[#19a463]"
          >
            Continue
            <ArrowRight className="ml-2 size-4" />
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="mt-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#404145]">
            About your organization
          </h1>
          <p className="mt-1.5 text-sm text-[#62646a]">
            We tailor your dashboard and pricing based on this.
          </p>

          <div className="mt-6 space-y-3">
            <Field label="Organization name" id="orgname" value={orgName} onChange={setOrgName} placeholder="e.g., Memorial Hermann Medical Center" autoComplete="organization" />

            <div className="space-y-1.5">
              <Label htmlFor="orgtype" className="text-sm font-semibold text-[#404145]">Organization type</Label>
              <Select value={orgType} onValueChange={(v) => setOrgType(v ?? '')}>
                <SelectTrigger id="orgtype" className="h-11 w-full"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {ORG_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="orgsize" className="text-sm font-semibold text-[#404145]">Organization size</Label>
              <Select value={orgSize} onValueChange={(v) => setOrgSize(v ?? '')}>
                <SelectTrigger id="orgsize" className="h-11 w-full"><SelectValue placeholder="People" /></SelectTrigger>
                <SelectContent>
                  {ORG_SIZES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_140px_120px]">
              <Field id="city" label="City" value={city} onChange={setCity} placeholder="e.g., Los Angeles" />
              <div className="space-y-1.5">
                <Label htmlFor="state" className="text-sm font-semibold text-[#404145]">State</Label>
                <Select value={state} onValueChange={(v) => setState(v ?? '')}>
                  <SelectTrigger id="state" className="h-11 w-full"><SelectValue placeholder="State" /></SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label} ({s.value})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field id="zip" label="ZIP" value={zipCode} onChange={setZipCode} placeholder="ZIP" maxLength={5} />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="h-11 flex-1">
              <ArrowLeft className="mr-2 size-4" />Back
            </Button>
            <Button disabled={!canStep2} onClick={() => setStep(3)} className="h-11 flex-1 bg-[#1dbf73] text-sm font-semibold text-white hover:bg-[#19a463]">
              Continue<ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mt-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#404145]">
            What kind of expertise are you looking for?
          </h1>
          <p className="mt-1.5 text-sm text-[#62646a]">
            Select everything that applies — you can search for all of these
            once you&apos;re in.
          </p>

          <div className="mt-6 space-y-2">
            {NEEDS.map((n) => {
              const active = needs.has(n.key)
              return (
                <button
                  key={n.key}
                  type="button"
                  onClick={() => toggleNeed(n.key)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                    active
                      ? 'border-[#1dbf73] bg-[#e8faf1]'
                      : 'border-[#e4e5e7] bg-white hover:border-[#bcebd5] hover:bg-[#fafefb]'
                  }`}
                >
                  <div
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border-2 ${
                      active ? 'border-[#1dbf73] bg-[#1dbf73]' : 'border-[#e4e5e7] bg-white'
                    }`}
                  >
                    {active && <Check className="size-3 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#404145]">{n.label}</p>
                    <p className="text-xs text-[#62646a]">{n.sub}</p>
                  </div>
                </button>
              )
            })}
            <div className="mt-2 space-y-1.5">
              <Label htmlFor="other" className="text-xs font-medium text-[#62646a]">Something else (optional)</Label>
              <Input id="other" value={otherNeed} onChange={(e) => setOtherNeed(e.target.value)} placeholder="Describe what you need…" maxLength={500} className="h-10" />
            </div>
          </div>

          <TermsConsent checked={acceptedTerms} onChange={setAcceptedTerms} />

          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)} disabled={loading} className="h-11 flex-1">
              <ArrowLeft className="mr-2 size-4" />Back
            </Button>
            <Button disabled={!canStep3 || loading} onClick={submitSignup} className="h-11 flex-1 bg-[#1dbf73] text-sm font-semibold text-white hover:bg-[#19a463]">
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create account<ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 4 && needsConfirmation && (
        <CheckEmailStep email={email.trim().toLowerCase()} onStartOver={startOver} />
      )}

      {step === 4 && !needsConfirmation && (
        <div className="mt-6 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#e8faf1]">
            <Check className="size-8 text-[#1dbf73]" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-[#404145]">
            Welcome to Sanus, {orgName}!
          </h2>
          <p className="mt-2 text-sm text-[#62646a]">
            Your organization account is ready. Pick how you want to start.
          </p>
          <div className="mt-6">
            <TwoFactorNotice />
          </div>
          <div className="mt-6 space-y-3">
            <Button
              onClick={() => router.push('/find-care')}
              className="h-11 w-full bg-[#1dbf73] text-sm font-semibold text-white hover:bg-[#19a463]"
            >
              Browse professionals
              <ArrowRight className="ml-2 size-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/facility/jobs/new')}
              className="h-11 w-full"
            >
              Post a project need
              <ArrowRight className="ml-2 size-4" />
            </Button>
            <p className="pt-3 text-xs text-[#62646a]">
              Need help finding the right professional? Our team can help.{' '}
              <Link href="/" className="font-semibold text-[#1dbf73] hover:underline">
                Contact us →
              </Link>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between text-xs font-medium text-[#62646a]">
        <span>Step {step} of {total}</span>
        <span>{Math.round((step / total) * 100)}%</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e4e5e7]">
        <div className="h-full rounded-full bg-[#1dbf73] transition-all" style={{ width: `${(step / total) * 100}%` }} />
      </div>
    </div>
  )
}

function Field({
  label,
  id,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  maxLength,
}: {
  label: string
  id: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  autoComplete?: string
  maxLength?: number
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold text-[#404145]">{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} maxLength={maxLength} className="h-11" />
    </div>
  )
}
