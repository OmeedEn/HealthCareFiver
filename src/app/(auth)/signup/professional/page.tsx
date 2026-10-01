'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { isDemoMode } from '@/lib/demo/data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Check,
  Stethoscope,
  Heart,
  Briefcase,
  GraduationCap,
  ShieldCheck,
  UserRound,
  Wallet,
  KeyRound,
} from 'lucide-react'

// Professional onboarding is intentionally short: pick a category, create
// the account, done. Everything else (credential documents, profile
// details, Stripe Connect payouts) lives on real dashboard pages that
// persist as you go — see the "what's next" checklist on the final screen.
// The account is created on the LAST step so a refresh before submitting
// loses nothing but a tile selection.

type Step = 1 | 2 | 3

type ProType = 'clinical' | 'allied' | 'consultant' | 'educator'

const PRO_TYPES: { key: ProType; title: string; sub: string; icon: React.ElementType }[] = [
  {
    key: 'clinical',
    title: 'Licensed clinical professional',
    sub: 'MD, DO, NP, PA, RN, PT, LCSW, PharmD, RDN, and more',
    icon: Stethoscope,
  },
  {
    key: 'allied',
    title: 'Allied or certified health practitioner',
    sub: 'Personal trainer, health coach, doula, acupuncturist, nutritionist, IBCLC, and more',
    icon: Heart,
  },
  {
    key: 'consultant',
    title: 'Healthcare consultant or advisor',
    sub: 'Healthcare attorney, compliance, billing, RCM, nursing consultant, healthcare IT, and more',
    icon: Briefcase,
  },
  {
    key: 'educator',
    title: 'Health educator or trainer',
    sub: 'CEU/CME course creator, workshop host, clinical skills trainer, certification programs',
    icon: GraduationCap,
  },
]

const NEXT_STEPS: { label: string; detail: string; href: string; icon: React.ElementType }[] = [
  {
    label: 'Verify your credentials',
    detail: 'Upload your license, certification, or ID so our team can review it.',
    href: '/contractor/credentials/upload',
    icon: ShieldCheck,
  },
  {
    label: 'Complete your profile',
    detail: 'Add your specialty, experience, NPI, and a short bio.',
    href: '/contractor/profile/edit',
    icon: UserRound,
  },
  {
    label: 'Set up payouts',
    detail: 'Connect a bank account securely through Stripe.',
    href: '/contractor/payments',
    icon: Wallet,
  },
]

export default function ProfessionalSignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)

  // Step 1 — type
  const [proType, setProType] = useState<ProType | null>(null)

  // Step 2 — account
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const canStep1 = proType !== null
  const canStep2 =
    !!proType &&
    firstName.trim() &&
    lastName.trim() &&
    email.trim() &&
    password.length >= 8 &&
    password === confirmPassword

  async function submitAccount() {
    if (!canStep2 || loading) return
    setLoading(true)
    if (isDemoMode()) {
      setStep(3)
      setLoading(false)
      return
    }
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'contractor',
          email: email.trim().toLowerCase(),
          password,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          // The granular license type is set later on the profile page;
          // 'other' keeps the contractor_type enum happy at signup.
          contractor_type: 'other',
          professional_category: proType,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error || 'Could not create account')
        return
      }
      setStep(3)
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {step < 3 && (
        <Link
          href="/signup"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#62646a] hover:text-[#404145]"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Link>
      )}

      {step < 3 && <Progress step={step} total={2} />}

      {step === 1 && (
        <div className="mt-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#404145]">
            What type of professional are you?
          </h1>
          <p className="mt-1.5 text-sm text-[#62646a]">
            Choose the category that best describes your primary expertise.
            You can change it later.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {PRO_TYPES.map((t) => {
              const Icon = t.icon
              const active = proType === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setProType(t.key)}
                  aria-pressed={active}
                  className={`group flex h-full flex-col items-start gap-3 rounded-xl border p-4 text-left transition ${
                    active
                      ? 'border-[#1dbf73] bg-[#e8faf1]'
                      : 'border-[#e4e5e7] bg-white hover:border-[#bcebd5] hover:bg-[#fafefb]'
                  }`}
                >
                  <div className={`flex size-10 items-center justify-center rounded-lg ${active ? 'bg-[#1dbf73] text-white' : 'bg-[#f7f7f7] text-[#62646a]'}`}>
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#404145]">{t.title}</p>
                    <p className="mt-1 text-xs text-[#62646a]">{t.sub}</p>
                  </div>
                </button>
              )
            })}
          </div>

          <p className="mt-6 text-center text-xs text-[#62646a]">
            Free to join and get verified. Once you&apos;re approved, it&apos;s
            $29/month to go live and get booked.
          </p>

          <Button disabled={!canStep1} onClick={() => setStep(2)} className="mt-4 h-11 w-full bg-[#1dbf73] text-sm font-semibold text-white hover:bg-[#19a463]">
            Continue<ArrowRight className="ml-2 size-4" />
          </Button>
        </div>
      )}

      {step === 2 && (
        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault()
            submitAccount()
          }}
        >
          <h1 className="text-2xl font-bold tracking-tight text-[#404145]">
            Create your account
          </h1>
          <p className="mt-1.5 text-sm text-[#62646a]">
            You can finish your profile, verification, and payouts from your
            dashboard.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Field label="First name" id="fn" value={firstName} onChange={setFirstName} autoComplete="given-name" />
            <Field label="Last name" id="ln" value={lastName} onChange={setLastName} autoComplete="family-name" />
          </div>
          <div className="mt-3">
            <Field label="Email address" id="email" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@example.com" />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Password" id="pw" type="password" value={password} onChange={setPassword} autoComplete="new-password" placeholder="Min 8 characters" />
            <Field label="Confirm password" id="pw2" type="password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" placeholder="Repeat password" />
          </div>
          {confirmPassword && password !== confirmPassword && (
            <p className="mt-2 text-xs text-red-600">Passwords don&apos;t match.</p>
          )}

          <div className="mt-6 flex gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(1)} className="h-11 flex-1"><ArrowLeft className="mr-2 size-4" />Back</Button>
            <Button type="submit" disabled={!canStep2 || loading} className="h-11 flex-1 bg-[#1dbf73] text-sm font-semibold text-white hover:bg-[#19a463]">
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create account
            </Button>
          </div>
          <p className="mt-3 text-center text-xs text-[#62646a]">
            By continuing you agree to Sanus&apos;s{' '}
            <Link href="/terms" className="font-medium underline hover:text-[#404145]">Terms of Service</Link>{' '}
            and{' '}
            <Link href="/privacy" className="font-medium underline hover:text-[#404145]">Privacy Policy</Link>.
          </p>
        </form>
      )}

      {step === 3 && (
        <div className="mt-6">
          <div className="text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#e8faf1]">
              <Check className="size-8 text-[#1dbf73]" />
            </div>
            <h2 className="mt-4 text-2xl font-bold text-[#404145]">
              You&apos;re in{firstName.trim() ? `, ${firstName.trim()}` : ''} — here&apos;s what&apos;s next
            </h2>
            <p className="mt-2 text-sm text-[#62646a]">
              Your account is created. Before you can be booked, finish these
              from your dashboard — in any order, at your own pace.
            </p>
          </div>

          <ul className="mt-6 divide-y divide-[#e4e5e7] rounded-xl border border-[#e4e5e7] bg-white">
            {NEXT_STEPS.map((s) => {
              const Icon = s.icon
              return (
                <li key={s.href}>
                  <Link href={s.href} className="flex items-start gap-3 p-4 transition hover:bg-[#fafefb]">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#f7f7f7] text-[#62646a]">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#404145]">{s.label}</p>
                      <p className="mt-0.5 text-xs text-[#62646a]">{s.detail}</p>
                    </div>
                    <span className="mt-0.5 shrink-0 text-xs font-medium text-[#62646a]">To do</span>
                  </Link>
                </li>
              )
            })}
          </ul>

          <p className="mt-4 text-center text-xs text-[#62646a]">
            Free to join and get verified. Once you&apos;re approved, it&apos;s
            $29/month to go live and get booked.
          </p>

          <div className="mt-6 rounded-xl border border-[#bcebd5] bg-[#e8faf1] p-4">
            <div className="flex gap-3">
              <KeyRound className="mt-0.5 size-5 shrink-0 text-[#0f8f56]" />
              <p className="text-xs text-[#0f8f56]">
                Next, you&apos;ll set up two-factor authentication with an
                authenticator app (like Google Authenticator, 1Password, or
                Authy). It&apos;s required for every account because Sanus
                handles health information.
              </p>
            </div>
          </div>

          <Button onClick={() => router.push('/dashboard')} className="mt-6 h-11 w-full bg-[#1dbf73] text-sm font-semibold text-white hover:bg-[#19a463]">
            Continue to your dashboard<ArrowRight className="ml-2 size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

/* ────────── Reusable inline components ────────── */

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
}: {
  label: string
  id: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  autoComplete?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold text-[#404145]">{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} className="h-11" />
    </div>
  )
}
