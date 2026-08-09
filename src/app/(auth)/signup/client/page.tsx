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
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Stethoscope,
  Brain,
  Heart,
  Sparkles,
  Activity,
  Dumbbell,
  Scale,
  GraduationCap,
  HelpCircle,
  Check,
} from 'lucide-react'

type Step = 1 | 2 | 3

const INTEREST_TILES = [
  { key: 'clinical', label: 'Clinical care', icon: Stethoscope, sub: 'Nursing, telehealth, home visits' },
  { key: 'mental_health', label: 'Mental health & counseling', icon: Brain, sub: 'Therapists, psychologists, counselors' },
  { key: 'nutrition', label: 'Nutrition & dietetics', icon: Heart, sub: 'RDNs, nutritionists, meal planning' },
  { key: 'coaching', label: 'Health coaching & wellness', icon: Sparkles, sub: 'Behavior change, lifestyle' },
  { key: 'physical_therapy', label: 'Physical therapy & rehab', icon: Activity, sub: 'PT, OT, recovery' },
  { key: 'fitness', label: 'Personal training & fitness', icon: Dumbbell, sub: 'Trainers, strength, conditioning' },
  { key: 'consulting', label: 'Healthcare consulting or legal advice', icon: Scale, sub: 'Attorneys, advisors, specialists' },
  { key: 'education', label: 'Events & continuing education', icon: GraduationCap, sub: 'CEU, workshops, certifications' },
  { key: 'other', label: 'Something else', icon: HelpCircle, sub: 'Tell us what you need' },
]

export default function ClientSignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)

  // Step 1 — account
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Step 2 — preferences
  const [interests, setInterests] = useState<Set<string>>(new Set())
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zipCode, setZipCode] = useState('')

  const canNextStep1 = firstName && lastName && email && password.length >= 8
  const canNextStep2 = interests.size > 0

  function toggleInterest(key: string) {
    setInterests((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleSubmitAccount() {
    setLoading(true)
    if (isDemoMode()) {
      // Skip the real API in demo
      setStep(2)
      setLoading(false)
      return
    }
    try {
      // Maps to existing 'contractor' role for now; a 'client' role would
      // need a separate enum migration. Clients with no professional fields
      // act as browse-only accounts.
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'contractor',
          email: email.trim().toLowerCase(),
          password,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          contractor_type: 'other',
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error || 'Could not create account')
        return
      }
      setStep(2)
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  function handleFinalize() {
    toast.success(`Welcome to Sanus, ${firstName}!`)
    setStep(3)
  }

  return (
    <div>
      <BackToPicker />
      <ProgressBar step={step} totalSteps={3} />

      {step === 1 && (
        <div className="mt-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#404145]">
            Find the health expertise you need
          </h1>
          <p className="mt-1.5 text-sm text-[#62646a]">
            Browse 4,800+ verified professionals — clinicians, coaches,
            consultants, and educators.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Field label="First name" id="fn" value={firstName} onChange={setFirstName} autoComplete="given-name" />
            <Field label="Last name" id="ln" value={lastName} onChange={setLastName} autoComplete="family-name" />
          </div>
          <div className="mt-3">
            <Field
              label="Email address"
              id="email"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>
          <div className="mt-3">
            <Field
              label="Password"
              id="pw"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              placeholder="Min 8 characters"
            />
          </div>

          <Button
            disabled={!canNextStep1 || loading}
            onClick={handleSubmitAccount}
            className="mt-6 h-11 w-full bg-[#1dbf73] text-sm font-semibold text-white hover:bg-[#19a463]"
          >
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Continue
            <ArrowRight className="ml-2 size-4" />
          </Button>
          <p className="mt-3 text-center text-xs text-[#62646a]">
            By continuing you agree to Sanus&apos;s Terms of Service and
            Privacy Policy.
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="mt-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#404145]">
            What brings you to Sanus?
          </h1>
          <p className="mt-1.5 text-sm text-[#62646a]">
            This helps us show you the most relevant professionals first.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {INTEREST_TILES.map((t) => {
              const Icon = t.icon
              const active = interests.has(t.key)
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => toggleInterest(t.key)}
                  className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                    active
                      ? 'border-[#1dbf73] bg-[#e8faf1]'
                      : 'border-[#e4e5e7] bg-white hover:border-[#bcebd5] hover:bg-[#fafefb]'
                  }`}
                >
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                      active ? 'bg-[#1dbf73] text-white' : 'bg-[#f7f7f7] text-[#62646a]'
                    }`}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#404145]">
                      {t.label}
                    </p>
                    <p className="text-xs text-[#62646a]">{t.sub}</p>
                  </div>
                  {active && (
                    <Check className="ml-auto mt-1 size-4 shrink-0 text-[#0f8f56]" />
                  )}
                </button>
              )
            })}
          </div>

          <p className="mt-6 text-sm font-semibold text-[#404145]">
            Where are you located?
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_140px_120px]">
            <Field id="city" label="City" value={city} onChange={setCity} placeholder="e.g., Los Angeles" />
            <div className="space-y-1.5">
              <Label htmlFor="state" className="text-sm font-semibold text-[#404145]">State</Label>
              <Select value={state} onValueChange={(v) => setState(v ?? '')}>
                <SelectTrigger id="state" className="h-11 w-full">
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label} ({s.value})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field id="zip" label="ZIP" value={zipCode} onChange={setZipCode} placeholder="ZIP" maxLength={5} />
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="h-11 flex-1"
            >
              <ArrowLeft className="mr-2 size-4" />
              Back
            </Button>
            <Button
              disabled={!canNextStep2}
              onClick={handleFinalize}
              className="h-11 flex-1 bg-[#1dbf73] text-sm font-semibold text-white hover:bg-[#19a463]"
            >
              Continue
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <WelcomeStep
          firstName={firstName}
          subtitle="Here are professionals that match what you're looking for. Start browsing your matches now."
          primary={{ label: 'Browse all professionals', href: '/find-care' }}
          secondary={{ label: 'Go to dashboard', href: '/dashboard' }}
          onPrimary={() => router.push('/find-care')}
        />
      )}
    </div>
  )
}

/* ────── Shared inline pieces ────── */

function BackToPicker() {
  return (
    <Link
      href="/signup"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#62646a] hover:text-[#404145]"
    >
      <ArrowLeft className="size-3.5" />
      Back
    </Link>
  )
}

function ProgressBar({ step, totalSteps }: { step: number; totalSteps: number }) {
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between text-xs font-medium text-[#62646a]">
        <span>
          Step {step} of {totalSteps}
        </span>
        <span>{Math.round((step / totalSteps) * 100)}%</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e4e5e7]">
        <div
          className="h-full rounded-full bg-[#1dbf73] transition-all"
          style={{ width: `${(step / totalSteps) * 100}%` }}
        />
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
      <Label htmlFor={id} className="text-sm font-semibold text-[#404145]">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        className="h-11"
      />
    </div>
  )
}

function WelcomeStep({
  firstName,
  subtitle,
  primary,
  secondary,
  onPrimary,
}: {
  firstName: string
  subtitle: string
  primary: { label: string; href: string }
  secondary?: { label: string; href: string }
  onPrimary?: () => void
}) {
  return (
    <div className="mt-6 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#e8faf1]">
        <Check className="size-8 text-[#1dbf73]" />
      </div>
      <h2 className="mt-4 text-2xl font-bold text-[#404145]">
        Welcome to Sanus, {firstName}!
      </h2>
      <p className="mt-2 text-sm text-[#62646a]">{subtitle}</p>
      <div className="mt-8 space-y-3">
        <Button
          onClick={onPrimary}
          className="h-11 w-full bg-[#1dbf73] text-sm font-semibold text-white hover:bg-[#19a463]"
        >
          {primary.label}
          <ArrowRight className="ml-2 size-4" />
        </Button>
        {secondary && (
          <Link
            href={secondary.href}
            className="block text-sm font-semibold text-[#62646a] hover:text-[#404145]"
          >
            {secondary.label}
          </Link>
        )}
      </div>
    </div>
  )
}
