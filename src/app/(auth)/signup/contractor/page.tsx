'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react'

const CONTRACTOR_TYPES = [
  { value: 'registered_nurse', label: 'Registered Nurse (RN)' },
  { value: 'licensed_practical_nurse', label: 'Licensed Practical Nurse (LPN)' },
  { value: 'certified_nursing_assistant', label: 'Certified Nursing Assistant (CNA)' },
  { value: 'nurse_practitioner', label: 'Nurse Practitioner (NP)' },
  { value: 'physician_assistant', label: 'Physician Assistant (PA)' },
  { value: 'physical_therapist', label: 'Physical Therapist (PT)' },
  { value: 'occupational_therapist', label: 'Occupational Therapist (OT)' },
  { value: 'speech_language_pathologist', label: 'Speech-Language Pathologist (SLP)' },
  { value: 'respiratory_therapist', label: 'Respiratory Therapist (RT)' },
  { value: 'medical_assistant', label: 'Medical Assistant (MA)' },
  { value: 'pharmacist', label: 'Pharmacist' },
  { value: 'radiology_technologist', label: 'Radiology Technologist' },
  { value: 'laboratory_technician', label: 'Laboratory Technician' },
  { value: 'surgical_technologist', label: 'Surgical Technologist' },
  { value: 'home_health_aide', label: 'Home Health Aide (HHA)' },
  { value: 'paramedic', label: 'Paramedic / EMT' },
  { value: 'dentist', label: 'Dentist' },
  { value: 'dental_hygienist', label: 'Dental Hygienist' },
  { value: 'other', label: 'Other' },
]

export default function ContractorSignupPage() {
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
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-600">
            <CheckCircle className="h-7 w-7" />
          </div>
          <CardTitle className="text-xl">Check Your Email</CardTitle>
          <CardDescription>
            We&apos;ve sent a confirmation link to <strong>{email}</strong>.
            Click the link to activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login">
            <Button variant="outline" className="w-full">
              Back to Sign In
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <Link
          href="/signup"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </Link>
        <CardTitle className="text-2xl font-bold text-blue-600">
          Professional Sign Up
        </CardTitle>
        <CardDescription>
          Create your healthcare professional account
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contractorType">Profession</Label>
            <Select value={contractorType} onValueChange={(v) => setContractorType(v ?? '')}>
              <SelectTrigger id="contractorType" className="w-full">
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

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
        </CardContent>

        <div className="px-4 pb-4 space-y-4">
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            size="lg"
          >
            {loading && <Loader2 className="animate-spin" />}
            Create Account
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 hover:underline font-medium">
              Sign In
            </Link>
          </p>
        </div>
      </form>
    </Card>
  )
}
