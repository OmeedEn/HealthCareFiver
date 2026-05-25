'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react'

const CONTRACTOR_TYPES = [
  { value: 'rn', label: 'Registered Nurse (RN)' },
  { value: 'lpn', label: 'Licensed Practical Nurse (LPN)' },
  { value: 'cna', label: 'Certified Nursing Assistant (CNA)' },
  { value: 'np', label: 'Nurse Practitioner (NP)' },
  { value: 'pa', label: 'Physician Assistant (PA)' },
  { value: 'md', label: 'Physician (MD/DO)' },
  { value: 'pt', label: 'Physical Therapist (PT)' },
  { value: 'ot', label: 'Occupational Therapist (OT)' },
  { value: 'slp', label: 'Speech-Language Pathologist (SLP)' },
  { value: 'rt', label: 'Respiratory Therapist (RT)' },
  { value: 'pharm', label: 'Pharmacist' },
  { value: 'rad_tech', label: 'Radiology Technologist' },
  { value: 'lab_tech', label: 'Laboratory Technician' },
  { value: 'ma', label: 'Medical Assistant (MA)' },
  { value: 'emt', label: 'Paramedic / EMT' },
  { value: 'other', label: 'Other' },
]

export default function ContractorSignupPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [contractorType, setContractorType] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (!contractorType) {
      toast.error('Please select your profession')
      return
    }

    setLoading(true)

    if (isDemoMode()) {
      toast.success('Welcome to HealthGig demo!')
      router.push('/dashboard')
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: 'contractor',
          first_name: firstName,
          last_name: lastName,
          contractor_type: contractorType,
        },
      },
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e8faf1]">
          <CheckCircle2 className="h-8 w-8 text-[#1dbf73]" />
        </div>
        <h2 className="mt-4 text-xl font-black text-[#404145]">
          Check your email
        </h2>
        <p className="mt-2 text-sm text-[#62646a]">
          We&apos;ve sent a confirmation link to <strong>{email}</strong>.
          <br />
          Click the link to activate your account.
        </p>
        <Link href="/login">
          <Button
            variant="outline"
            className="mt-6 h-11 w-full font-semibold"
          >
            Back to Sign In
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div>
      <Link
        href="/signup"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#62646a] hover:text-[#404145]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </Link>

      <h1 className="mt-4 text-2xl font-black tracking-tight text-[#404145]">
        Create your account
      </h1>
      <p className="mt-1.5 text-sm text-[#62646a]">
        Sign up as a healthcare professional
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-[#404145]">
              First name
            </Label>
            <Input
              placeholder="Sarah"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-[#404145]">
              Last name
            </Label>
            <Input
              placeholder="Johnson"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="h-11"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-[#404145]">
            Profession
          </Label>
          <Select
            value={contractorType}
            onValueChange={(v) => setContractorType(v ?? '')}
          >
            <SelectTrigger className="h-11 w-full">
              <SelectValue placeholder="Select your profession" />
            </SelectTrigger>
            <SelectContent>
              {CONTRACTOR_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-[#404145]">
            Email address
          </Label>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-[#404145]">
              Password
            </Label>
            <Input
              type="password"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-[#404145]">
              Confirm
            </Label>
            <Input
              type="password"
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="h-11"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full bg-[#1dbf73] text-sm font-bold text-white hover:bg-[#19a463]"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Account
        </Button>

        <p className="text-center text-xs text-[#95979d]">
          By signing up, you agree to HealthGig&apos;s Terms of Service and
          Privacy Policy.
        </p>
      </form>

      <Separator className="my-6" />

      <p className="text-center text-sm text-[#62646a]">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-bold text-[#1dbf73] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
