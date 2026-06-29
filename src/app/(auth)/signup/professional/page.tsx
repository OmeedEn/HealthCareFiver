'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { isDemoMode } from '@/lib/demo/data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  Check,
  Stethoscope,
  Heart,
  Briefcase,
  GraduationCap,
  Upload,
  FileText,
  X,
  Calendar as CalendarIcon,
  ShieldCheck,
  Wallet,
} from 'lucide-react'

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7

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

const YEARS_OPTIONS = ['0–1 years', '2–5 years', '6–10 years', '10+ years']

export default function ProfessionalSignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)

  // Step 1 — account
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Step 2 — type
  const [proType, setProType] = useState<ProType | null>(null)

  // Step 3 — credentials (varies by branch; we store everything in one object)
  const [licenseType, setLicenseType] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [licenseState, setLicenseState] = useState('')
  const [npi, setNpi] = useState('')
  const [yearsPractice, setYearsPractice] = useState('')
  const [practiceSetting, setPracticeSetting] = useState('')
  const [certifyingBody, setCertifyingBody] = useState('')
  const [serviceFormat, setServiceFormat] = useState('')
  const [background, setBackground] = useState('')
  const [serves, setServes] = useState<Set<string>>(new Set())
  const [engagementTypes, setEngagementTypes] = useState<Set<string>>(new Set())
  const [primaryBackground, setPrimaryBackground] = useState('')
  const [educationTypes, setEducationTypes] = useState<Set<string>>(new Set())
  const [targetAudience, setTargetAudience] = useState<Set<string>>(new Set())
  const [accreditation, setAccreditation] = useState('')

  // Step 4 — documents (mock: just track names)
  const [docs, setDocs] = useState<{ label: string; name: string }[]>([])

  // Step 5 — offerings
  const [offerings, setOfferings] = useState<Set<'services' | 'consulting' | 'events'>>(new Set())
  const [serviceName, setServiceName] = useState('')
  const [serviceDescription, setServiceDescription] = useState('')
  const [servicePrice, setServicePrice] = useState('')
  const [consultingArea, setConsultingArea] = useState('')
  const [eventTitle, setEventTitle] = useState('')
  const [eventPrice, setEventPrice] = useState('')

  // Step 6 — payouts
  const [accountHolder, setAccountHolder] = useState('')
  const [routingNumber, setRoutingNumber] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [dob, setDob] = useState('')
  const [last4Ssn, setLast4Ssn] = useState('')
  const [payoutsSkipped, setPayoutsSkipped] = useState(false)

  const canStep1 =
    firstName && lastName && email && password.length >= 8 && password === confirmPassword
  const canStep2 = proType !== null
  const canStep3 = !!proType /* relaxed — fields are optional polish */
  const canStep5 = offerings.size > 0

  function toggleSet<T extends string>(
    set: Set<T>,
    setter: (s: Set<T>) => void,
    val: T,
  ) {
    const next = new Set(set)
    if (next.has(val)) next.delete(val)
    else next.add(val)
    setter(next)
  }

  function handleFileSelect(label: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setDocs((prev) => [...prev.filter((d) => d.label !== label), { label, name: file.name }])
  }

  async function submitAccount() {
    setLoading(true)
    if (isDemoMode()) {
      setStep(2)
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
          // contractor_type gets refined in step 3 — start with 'other' so the
          // signup succeeds, the contractor_profile gets updated after.
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

  function complete() {
    toast.success('Setup complete!')
    setStep(7)
  }

  return (
    <div>
      <Link
        href="/signup"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#62646a] hover:text-[#404145]"
      >
        <ArrowLeft className="size-3.5" />
        Back
      </Link>

      {step <= 6 && <Progress step={step} total={6} />}

      {step === 1 && (
        <div className="mt-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#404145]">
            Let&apos;s get you set up
          </h1>
          <p className="mt-1.5 text-sm text-[#62646a]">
            This takes about 5 minutes. You can finish your profile later.
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

          <Button disabled={!canStep1 || loading} onClick={submitAccount} className="mt-6 h-11 w-full bg-[#1dbf73] text-sm font-semibold text-white hover:bg-[#19a463]">
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Continue<ArrowRight className="ml-2 size-4" />
          </Button>
          <p className="mt-3 text-center text-xs text-[#62646a]">
            By continuing you agree to Sanus&apos;s Terms of Service and Privacy Policy.
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="mt-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#404145]">
            What type of professional are you?
          </h1>
          <p className="mt-1.5 text-sm text-[#62646a]">
            Choose the category that best describes your primary expertise. You
            can add more later.
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

          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="h-11 flex-1"><ArrowLeft className="mr-2 size-4" />Back</Button>
            <Button disabled={!canStep2} onClick={() => setStep(3)} className="h-11 flex-1 bg-[#1dbf73] text-sm font-semibold text-white hover:bg-[#19a463]">
              Continue<ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mt-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#404145]">
            Your credentials
          </h1>
          <p className="mt-1.5 text-sm text-[#62646a]">
            We&apos;ll use this to verify you. You can edit anything later.
          </p>

          <div className="mt-6 space-y-3">
            {proType === 'clinical' && (
              <>
                <Field label="Profession / license type" id="lt" value={licenseType} onChange={setLicenseType} placeholder="e.g., Registered Nurse (RN)" />
                <Field label="Primary specialty" id="sp" value={specialty} onChange={setSpecialty} placeholder="e.g., ICU / Critical Care" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="License number" id="ln-num" value={licenseNumber} onChange={setLicenseNumber} />
                  <div className="space-y-1.5">
                    <Label htmlFor="lstate" className="text-sm font-semibold text-[#404145]">Licensing state</Label>
                    <Select value={licenseState} onValueChange={(v) => setLicenseState(v ?? '')}>
                      <SelectTrigger id="lstate" className="h-11 w-full"><SelectValue placeholder="State" /></SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label} ({s.value})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Field label="NPI number" id="npi" value={npi} onChange={setNpi} placeholder="10-digit federal NPI (if applicable)" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField id="yp" label="Years in practice" value={yearsPractice} onChange={setYearsPractice} options={YEARS_OPTIONS} />
                  <SelectField id="ps" label="Practice setting" value={practiceSetting} onChange={setPracticeSetting} options={['Telehealth only', 'In-person only', 'Both', 'I offer consulting', 'I offer education']} />
                </div>
              </>
            )}

            {proType === 'allied' && (
              <>
                <Field label="Certification type" id="ct" value={licenseType} onChange={setLicenseType} placeholder="e.g., NASM-CPT, IBCLC, LAc" />
                <Field label="Primary specialty or focus area" id="sp" value={specialty} onChange={setSpecialty} placeholder="e.g., Strength & conditioning, lactation, sports recovery" />
                <Field label="Certifying body" id="cb" value={certifyingBody} onChange={setCertifyingBody} placeholder="e.g., NASM, ACE, DONA, IBLCE" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField id="yp" label="Years of experience" value={yearsPractice} onChange={setYearsPractice} options={YEARS_OPTIONS} />
                  <SelectField id="sf" label="Service format" value={serviceFormat} onChange={setServiceFormat} options={['Telehealth', 'In-person', 'Home visits', 'Events', 'Consulting']} />
                </div>
              </>
            )}

            {proType === 'consultant' && (
              <>
                <Field label="Consulting specialty" id="cs" value={specialty} onChange={setSpecialty} placeholder="e.g., HIPAA Compliance, Medical Billing, RCM" />
                <div className="space-y-1.5">
                  <Label htmlFor="bg" className="text-sm font-semibold text-[#404145]">Background</Label>
                  <Textarea id="bg" value={background} onChange={(e) => setBackground(e.target.value)} placeholder='e.g., "Former hospital CFO" or "20 years in healthcare law"' rows={3} />
                </div>
                <CheckboxList
                  label="Who you typically serve"
                  options={['Individuals', 'Small practices', 'Hospitals & health systems', 'Startups', 'Other professionals']}
                  value={serves}
                  onChange={(v) => toggleSet(serves, setServes, v)}
                />
                <CheckboxList
                  label="Engagement types offered"
                  options={['One-time consult', 'Project-based', 'Ongoing retainer', 'Speaking', 'Education']}
                  value={engagementTypes}
                  onChange={(v) => toggleSet(engagementTypes, setEngagementTypes, v)}
                />
              </>
            )}

            {proType === 'educator' && (
              <>
                <Field label="Primary professional background" id="pb" value={primaryBackground} onChange={setPrimaryBackground} placeholder="What are you first, before educator? e.g., RN, MD" />
                <CheckboxList
                  label="Type of education offered"
                  options={['Live webinars', 'In-person workshops', 'Self-paced courses', 'CEU/CME courses', 'Certification programs', 'Corporate training']}
                  value={educationTypes}
                  onChange={(v) => toggleSet(educationTypes, setEducationTypes, v)}
                />
                <CheckboxList
                  label="Target audience"
                  options={['Other healthcare professionals', 'Individuals and consumers', 'Businesses and organizations']}
                  value={targetAudience}
                  onChange={(v) => toggleSet(targetAudience, setTargetAudience, v)}
                />
                <SelectField id="acc" label="Accreditation" value={accreditation} onChange={setAccreditation} options={['Seeking CEU accreditation', 'Already accredited', 'Not applicable']} />
              </>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)} className="h-11 flex-1"><ArrowLeft className="mr-2 size-4" />Back</Button>
            <Button disabled={!canStep3} onClick={() => setStep(4)} className="h-11 flex-1 bg-[#1dbf73] text-sm font-semibold text-white hover:bg-[#19a463]">
              Continue<ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 4 && proType && (
        <div className="mt-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#404145]">
            Let&apos;s verify your credentials
          </h1>
          <p className="mt-1.5 text-sm text-[#62646a]">
            Sanus verifies every professional before they go live. This
            protects you and the people you serve.
          </p>

          <div className="mt-6 space-y-3">
            {(proType === 'clinical'
              ? [
                  { label: 'Active license', help: "We'll cross-reference this with your state licensing board." },
                  { label: 'Proof of malpractice insurance', help: 'Required for clinical services.' },
                  { label: 'Government-issued ID', help: 'Driver\'s license or passport.' },
                  { label: 'Additional certifications (optional)', help: '', optional: true },
                ]
              : proType === 'allied'
                ? [
                    { label: 'Primary certification', help: '' },
                    { label: 'Government-issued ID', help: '' },
                    { label: 'Additional certifications (optional)', help: '', optional: true },
                  ]
                : proType === 'consultant'
                  ? [
                      { label: 'Resume or CV', help: 'So clients know your background.' },
                      { label: 'Government-issued ID', help: '' },
                      { label: 'Bar card, professional certifications, or sample work (optional)', help: '', optional: true },
                    ]
                  : [
                      { label: 'Primary credential (license or certification)', help: '' },
                      { label: 'Government-issued ID', help: '' },
                      { label: 'CEU accreditation documentation (optional)', help: '', optional: true },
                    ]
            ).map((d) => (
              <UploadRow
                key={d.label}
                label={d.label}
                help={d.help}
                optional={d.optional}
                uploaded={docs.find((x) => x.label === d.label)?.name}
                onChange={(e) => handleFileSelect(d.label, e)}
              />
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-[#bcebd5] bg-[#e8faf1] p-4">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#0f8f56]" />
              <p className="text-xs text-[#0f8f56]">
                Your documents are reviewed by the Sanus team within 24–48
                hours. You&apos;ll receive an email when you&apos;re approved
                to go live. Your profile is saved and you can continue
                setting it up while we review.
              </p>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => setStep(3)} className="h-11 flex-1"><ArrowLeft className="mr-2 size-4" />Back</Button>
            <Button onClick={() => setStep(5)} className="h-11 flex-1 bg-[#1dbf73] text-sm font-semibold text-white hover:bg-[#19a463]">
              Continue<ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="mt-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#404145]">
            What will you offer on Sanus?
          </h1>
          <p className="mt-1.5 text-sm text-[#62646a]">
            You can add more later. Start with your most common offering.
          </p>

          <div className="mt-6 space-y-3">
            <OfferingCard
              icon={Stethoscope}
              title="Services"
              sub="1:1 sessions, consults, assessments, home visits, telehealth"
              active={offerings.has('services')}
              onToggle={() => toggleSet(offerings, setOfferings, 'services')}
            >
              <Field id="sn" label="Service name" value={serviceName} onChange={setServiceName} placeholder="e.g., 60-min telehealth consult" />
              <div className="space-y-1.5">
                <Label htmlFor="sd" className="text-sm font-semibold text-[#404145]">Description</Label>
                <Textarea id="sd" value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} placeholder="What's included…" rows={3} />
              </div>
              <Field id="sp" label="Starting price (USD)" value={servicePrice} onChange={setServicePrice} placeholder="e.g., 120" type="number" />
            </OfferingCard>

            <OfferingCard
              icon={Briefcase}
              title="Consulting"
              sub="Project work, advisory, retainers, expert witness, business consulting"
              active={offerings.has('consulting')}
              onToggle={() => toggleSet(offerings, setOfferings, 'consulting')}
            >
              <Field id="ca" label="Consulting area" value={consultingArea} onChange={setConsultingArea} placeholder="e.g., HIPAA audits, RCM strategy" />
            </OfferingCard>

            <OfferingCard
              icon={CalendarIcon}
              title="Events & education"
              sub="Webinars, workshops, courses, CEU programs"
              active={offerings.has('events')}
              onToggle={() => toggleSet(offerings, setOfferings, 'events')}
            >
              <Field id="et" label="Event title" value={eventTitle} onChange={setEventTitle} placeholder="e.g., IV Therapy Fundamentals" />
              <Field id="ep" label="Price (USD) or 0 for Free" value={eventPrice} onChange={setEventPrice} placeholder="e.g., 49" type="number" />
            </OfferingCard>
          </div>

          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => setStep(4)} className="h-11 flex-1"><ArrowLeft className="mr-2 size-4" />Back</Button>
            <Button disabled={!canStep5} onClick={() => setStep(6)} className="h-11 flex-1 bg-[#1dbf73] text-sm font-semibold text-white hover:bg-[#19a463]">
              Continue<ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="mt-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#404145]">
            Set up your payouts
          </h1>
          <p className="mt-1.5 text-sm text-[#62646a]">
            Connect your bank account so you can receive payments. Sanus pays
            out weekly via Stripe. You keep 80% of every transaction.
          </p>

          <div className="mt-6 space-y-3">
            <Field id="ah" label="Bank account holder name" value={accountHolder} onChange={setAccountHolder} placeholder="Full legal name" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="rn" label="Routing number" value={routingNumber} onChange={setRoutingNumber} placeholder="9 digits" maxLength={9} />
              <Field id="an" label="Account number" value={accountNumber} onChange={setAccountNumber} placeholder="Checking account" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="dob" label="Date of birth" type="date" value={dob} onChange={setDob} />
              <Field id="ssn" label="Last 4 of SSN" value={last4Ssn} onChange={setLast4Ssn} placeholder="4 digits" maxLength={4} />
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-[#e4e5e7] bg-[#fafefb] p-4">
            <div className="flex gap-3">
              <Wallet className="mt-0.5 size-5 shrink-0 text-[#0f8f56]" />
              <p className="text-xs text-[#62646a]">
                This information is sent directly to Stripe, our payment
                processor. Sanus never stores your banking details.
              </p>
            </div>
          </div>

          <Button onClick={complete} className="mt-6 h-11 w-full bg-[#1dbf73] text-sm font-semibold text-white hover:bg-[#19a463]">
            Complete setup &amp; go to my dashboard
            <ArrowRight className="ml-2 size-4" />
          </Button>
          <button
            type="button"
            onClick={() => {
              setPayoutsSkipped(true)
              complete()
            }}
            className="mt-3 block w-full text-center text-xs font-medium text-[#62646a] hover:text-[#404145]"
          >
            Set up payouts later
          </button>

          <div className="mt-6 flex">
            <Button variant="outline" onClick={() => setStep(5)} className="h-11 w-full">
              <ArrowLeft className="mr-2 size-4" />Back
            </Button>
          </div>
        </div>
      )}

      {step === 7 && (
        <div className="mt-6 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#e8faf1]">
            <Check className="size-8 text-[#1dbf73]" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-[#404145]">
            You&apos;re almost live, {firstName}
          </h2>
          <p className="mt-2 text-sm text-[#62646a]">
            Your profile is saved. We&apos;ll email you the moment your
            credentials are approved.
          </p>

          <div className="mt-6 space-y-2.5 rounded-xl border border-[#e4e5e7] bg-[#fafefb] p-4 text-left">
            <StatusRow label="Account created" status="done" />
            <StatusRow label="Credential review" status="pending" detail="In progress — 24–48 hours" />
            <StatusRow label="Payouts" status={payoutsSkipped ? 'skipped' : 'done'} />
          </div>

          <div className="mt-6 space-y-3">
            <Button onClick={() => router.push('/dashboard')} className="h-11 w-full bg-[#1dbf73] text-sm font-semibold text-white hover:bg-[#19a463]">
              Complete my profile<ArrowRight className="ml-2 size-4" />
            </Button>
            <Button variant="outline" onClick={() => router.push('/contractor/profile')} className="h-11 w-full">
              Preview my profile
            </Button>
          </div>
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

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold text-[#404145]">{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v ?? '')}>
        <SelectTrigger id={id} className="h-11 w-full"><SelectValue placeholder="Choose…" /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}

function CheckboxList({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: Set<string>
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-[#404145]">{label}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const checked = value.has(o)
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-left text-sm transition ${
                checked ? 'border-[#1dbf73] bg-[#e8faf1] text-[#0f8f56]' : 'border-[#e4e5e7] bg-white text-[#404145] hover:bg-[#f7f7f7]'
              }`}
            >
              <span className={`flex size-4 shrink-0 items-center justify-center rounded border-2 ${checked ? 'border-[#1dbf73] bg-[#1dbf73]' : 'border-[#e4e5e7] bg-white'}`}>
                {checked && <Check className="size-2.5 text-white" />}
              </span>
              {o}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function UploadRow({
  label,
  help,
  optional,
  uploaded,
  onChange,
}: {
  label: string
  help: string
  optional?: boolean
  uploaded?: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const id = `up-${label.replace(/\s+/g, '-')}`
  return (
    <div className="rounded-lg border border-[#e4e5e7] bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#404145]">
            {label}{' '}
            {optional && <span className="text-xs font-medium text-[#62646a]">(optional)</span>}
          </p>
          {help && <p className="mt-0.5 text-xs text-[#62646a]">{help}</p>}
        </div>
        {uploaded ? (
          <div className="flex items-center gap-1 rounded-md bg-[#e8faf1] px-2 py-1 text-xs font-medium text-[#0f8f56]">
            <FileText className="size-3" />
            <span className="max-w-[120px] truncate">{uploaded}</span>
            <button onClick={() => {/* removal handled by reselecting */}} className="ml-1">
              <X className="size-3" />
            </button>
          </div>
        ) : (
          <label htmlFor={id} className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-[#bcebd5] bg-white px-3 py-1.5 text-xs font-semibold text-[#0f8f56] hover:bg-[#e8faf1]">
            <Upload className="size-3.5" />
            Upload
            <input id={id} type="file" className="sr-only" onChange={onChange} accept="application/pdf,image/*" />
          </label>
        )}
      </div>
    </div>
  )
}

function OfferingCard({
  icon: Icon,
  title,
  sub,
  active,
  onToggle,
  children,
}: {
  icon: React.ElementType
  title: string
  sub: string
  active: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className={`rounded-xl border transition ${active ? 'border-[#1dbf73] bg-[#fafefb]' : 'border-[#e4e5e7] bg-white'}`}>
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 p-4 text-left">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-[#1dbf73] text-white' : 'bg-[#f7f7f7] text-[#62646a]'}`}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#404145]">{title}</p>
          <p className="mt-0.5 text-xs text-[#62646a]">{sub}</p>
        </div>
        <span className={`mt-1 flex size-5 shrink-0 items-center justify-center rounded border-2 ${active ? 'border-[#1dbf73] bg-[#1dbf73]' : 'border-[#e4e5e7] bg-white'}`}>
          {active && <Check className="size-3 text-white" />}
        </span>
      </button>
      {active && (
        <div className="space-y-3 border-t border-[#e4e5e7] p-4">
          {children}
        </div>
      )}
    </div>
  )
}

function StatusRow({
  label,
  status,
  detail,
}: {
  label: string
  status: 'done' | 'pending' | 'skipped'
  detail?: string
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
        status === 'done' ? 'bg-[#1dbf73]' : status === 'pending' ? 'bg-amber-400' : 'bg-[#e4e5e7]'
      }`}>
        {status === 'done' && <Check className="size-3 text-white" />}
      </div>
      <div className="flex-1">
        <p className="font-medium text-[#404145]">{label}</p>
        {detail && <p className="text-xs text-[#62646a]">{detail}</p>}
      </div>
      <span className={`text-xs font-medium ${
        status === 'done' ? 'text-[#0f8f56]' : status === 'pending' ? 'text-amber-700' : 'text-[#62646a]'
      }`}>
        {status === 'done' ? 'Complete' : status === 'pending' ? 'In progress' : 'Skipped'}
      </span>
    </div>
  )
}
