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
import { US_STATES } from '@/lib/utils/constants'

const FACILITY_TYPES = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'nursing_home', label: 'Nursing Home' },
  { value: 'assisted_living', label: 'Assisted Living Facility' },
  { value: 'home_health_agency', label: 'Home Health Agency' },
  { value: 'rehabilitation_center', label: 'Rehabilitation Center' },
  { value: 'urgent_care', label: 'Urgent Care Center' },
  { value: 'dental_office', label: 'Dental Office' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'mental_health', label: 'Mental Health Facility' },
  { value: 'hospice', label: 'Hospice' },
  { value: 'surgical_center', label: 'Surgical Center' },
  { value: 'diagnostic_lab', label: 'Diagnostic Laboratory' },
  { value: 'other', label: 'Other' },
]

export default function FacilitySignupPage() {
  const router = useRouter()
  const [facilityName, setFacilityName] = useState('')
  const [facilityType, setFacilityType] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (!facilityType) {
      toast.error('Please select a facility type')
      return
    }

    if (!state) {
      toast.error('Please select a state')
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
          role: 'facility',
          facility_name: facilityName,
          facility_type: facilityType,
          contact_name: contactName,
          city,
          state,
          zip_code: zipCode,
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
        Register your facility
      </h1>
      <p className="mt-1.5 text-sm text-[#62646a]">
        Create your healthcare facility account
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-[#404145]">
              Facility name
            </Label>
            <Input
              placeholder="Your facility name"
              value={facilityName}
              onChange={(e) => setFacilityName(e.target.value)}
              required
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-[#404145]">
              Facility type
            </Label>
            <Select value={facilityType} onValueChange={(v) => setFacilityType(v ?? '')}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {FACILITY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-[#404145]">
            Contact name
          </Label>
          <Input
            placeholder="Full name of primary contact"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            required
            className="h-11"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-[#404145]">
            Email address
          </Label>
          <Input
            type="email"
            placeholder="facility@example.com"
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
              placeholder="Min 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-[#404145]">
              Confirm password
            </Label>
            <Input
              type="password"
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="h-11"
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label className="text-sm font-semibold text-[#404145]">
              City
            </Label>
            <Input
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-[#404145]">
              State
            </Label>
            <Select value={state} onValueChange={(v) => setState(v ?? '')}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-[#404145]">
              ZIP code
            </Label>
            <Input
              placeholder="ZIP"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              required
              pattern="[0-9]{5}"
              maxLength={5}
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
