'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CONTRACTOR_TYPE_LABELS,
  JOB_TYPE_LABELS,
  SHIFT_TYPE_LABELS,
  US_STATES,
} from '@/lib/utils/constants'
import { toast } from 'sonner'
import { Loader2Icon, XIcon, PlusIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface JobFormData {
  title: string
  description: string
  contractor_type: string
  specialties_required: string[]
  job_type: string
  shift_type: string
  urgency: string
  positions_available: string
  city: string
  state: string
  zip_code: string
  is_remote: boolean
  pay_rate_min: string
  pay_rate_max: string
  pay_rate_type: string
  overtime_rate: string
  travel_reimbursement: boolean
  housing_provided: boolean
  start_date: string
  end_date: string
  shifts_per_week: string
  hours_per_shift: string
  years_experience_min: string
  required_credentials: string[]
  required_certifications: string[]
  additional_requirements: string
}

const initialFormData: JobFormData = {
  title: '',
  description: '',
  contractor_type: '',
  specialties_required: [],
  job_type: '',
  shift_type: '',
  urgency: 'normal',
  positions_available: '1',
  city: '',
  state: '',
  zip_code: '',
  is_remote: false,
  pay_rate_min: '',
  pay_rate_max: '',
  pay_rate_type: 'hourly',
  overtime_rate: '',
  travel_reimbursement: false,
  housing_provided: false,
  start_date: '',
  end_date: '',
  shifts_per_week: '',
  hours_per_shift: '',
  years_experience_min: '',
  required_credentials: [],
  required_certifications: [],
  additional_requirements: '',
}

export default function FacilityNewJobPage() {
  const router = useRouter()
  const [form, setForm] = useState<JobFormData>(initialFormData)
  const [loading, setLoading] = useState(false)
  const [specialtyInput, setSpecialtyInput] = useState('')
  const [credentialInput, setCredentialInput] = useState('')
  const [certificationInput, setCertificationInput] = useState('')

  const updateField = <K extends keyof JobFormData>(
    key: K,
    value: JobFormData[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const addToList = (
    key: 'specialties_required' | 'required_credentials' | 'required_certifications',
    value: string,
    clearInput: () => void
  ) => {
    const trimmed = value.trim()
    if (!trimmed) return
    if (form[key].includes(trimmed)) return
    updateField(key, [...form[key], trimmed])
    clearInput()
  }

  const removeFromList = (
    key: 'specialties_required' | 'required_credentials' | 'required_certifications',
    value: string
  ) => {
    updateField(
      key,
      form[key].filter((v) => v !== value)
    )
  }

  const handleSubmit = async (status: 'draft' | 'open') => {
    if (!form.title.trim()) {
      toast.error('Job title is required.')
      return
    }

    setLoading(true)

    if (isDemoMode()) {
      toast.success(
        status === 'open'
          ? 'Job published successfully! (demo mode)'
          : 'Draft saved successfully! (demo mode)'
      )
      router.push('/facility/jobs')
      return
    }

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error('You must be logged in.')
        return
      }

      const insertData: Record<string, unknown> = {
        facility_id: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        contractor_type: form.contractor_type || null,
        specialties_required:
          form.specialties_required.length > 0
            ? form.specialties_required
            : null,
        job_type: form.job_type || null,
        shift_type: form.shift_type || null,
        urgency: form.urgency || 'normal',
        positions_available: form.positions_available
          ? parseInt(form.positions_available)
          : 1,
        city: form.city.trim() || null,
        state: form.state || null,
        zip_code: form.zip_code.trim() || null,
        is_remote: form.is_remote,
        pay_rate_min: form.pay_rate_min
          ? parseFloat(form.pay_rate_min)
          : null,
        pay_rate_max: form.pay_rate_max
          ? parseFloat(form.pay_rate_max)
          : null,
        pay_rate_type: form.pay_rate_type || null,
        overtime_rate: form.overtime_rate
          ? parseFloat(form.overtime_rate)
          : null,
        travel_reimbursement: form.travel_reimbursement,
        housing_provided: form.housing_provided,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        shifts_per_week: form.shifts_per_week
          ? parseInt(form.shifts_per_week)
          : null,
        hours_per_shift: form.hours_per_shift
          ? parseFloat(form.hours_per_shift)
          : null,
        years_experience_min: form.years_experience_min
          ? parseInt(form.years_experience_min)
          : null,
        required_credentials:
          form.required_credentials.length > 0
            ? form.required_credentials
            : null,
        required_certifications:
          form.required_certifications.length > 0
            ? form.required_certifications
            : null,
        additional_requirements:
          form.additional_requirements.trim() || null,
        status,
        published_at: status === 'open' ? new Date().toISOString() : null,
      }

      const { error } = await supabase.from('jobs').insert(insertData)

      if (error) {
        toast.error('Failed to create job posting.')
        return
      }

      toast.success(
        status === 'open'
          ? 'Job published successfully!'
          : 'Draft saved successfully!'
      )
      router.push('/facility/jobs')
    } catch {
      toast.error('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Post a New Job</h1>
        <p className="text-muted-foreground">
          Fill in the details below to create a new job posting.
        </p>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Provide the essential details about the position.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Job Title *</Label>
            <Input
              id="title"
              placeholder="e.g. Registered Nurse - ICU"
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the role, responsibilities, and what you're looking for..."
              rows={6}
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contractor_type">Contractor Type</Label>
            <Select
              value={form.contractor_type}
              onValueChange={(v) => v != null && updateField('contractor_type', v)}
            >
              <SelectTrigger className="w-full" id="contractor_type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CONTRACTOR_TYPE_LABELS).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Required Specialties</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add a specialty"
                value={specialtyInput}
                onChange={(e) => setSpecialtyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addToList('specialties_required', specialtyInput, () =>
                      setSpecialtyInput('')
                    )
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() =>
                  addToList('specialties_required', specialtyInput, () =>
                    setSpecialtyInput('')
                  )
                }
              >
                <PlusIcon className="size-4" />
              </Button>
            </div>
            {form.specialties_required.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {form.specialties_required.map((s) => (
                  <Badge key={s} variant="secondary">
                    {s}
                    <button
                      type="button"
                      className="ml-1"
                      onClick={() =>
                        removeFromList('specialties_required', s)
                      }
                    >
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Job Details */}
      <Card>
        <CardHeader>
          <CardTitle>Job Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="job_type">Job Type</Label>
              <Select
                value={form.job_type}
                onValueChange={(v) => v != null && updateField('job_type', v)}
              >
                <SelectTrigger className="w-full" id="job_type">
                  <SelectValue placeholder="Select job type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(JOB_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shift_type">Shift Type</Label>
              <Select
                value={form.shift_type}
                onValueChange={(v) => v != null && updateField('shift_type', v)}
              >
                <SelectTrigger className="w-full" id="shift_type">
                  <SelectValue placeholder="Select shift type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SHIFT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="urgency">Urgency</Label>
              <Select
                value={form.urgency}
                onValueChange={(v) => v != null && updateField('urgency', v)}
              >
                <SelectTrigger className="w-full" id="urgency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="positions_available">Positions Available</Label>
              <Input
                id="positions_available"
                type="number"
                min="1"
                value={form.positions_available}
                onChange={(e) =>
                  updateField('positions_available', e.target.value)
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="City"
                value={form.city}
                onChange={(e) => updateField('city', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">State</Label>
              <Select
                value={form.state}
                onValueChange={(v) => v != null && updateField('state', v)}
              >
                <SelectTrigger className="w-full" id="state">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zip_code">ZIP Code</Label>
              <Input
                id="zip_code"
                placeholder="ZIP"
                value={form.zip_code}
                onChange={(e) => updateField('zip_code', e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_remote"
              checked={form.is_remote}
              onChange={(e) => updateField('is_remote', e.target.checked)}
              className="size-4 rounded border-input"
            />
            <Label htmlFor="is_remote">Remote eligible</Label>
          </div>
        </CardContent>
      </Card>

      {/* Compensation */}
      <Card>
        <CardHeader>
          <CardTitle>Compensation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="pay_rate_min">Pay Rate Min ($)</Label>
              <Input
                id="pay_rate_min"
                type="number"
                step="0.01"
                min="0"
                placeholder="Min"
                value={form.pay_rate_min}
                onChange={(e) => updateField('pay_rate_min', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay_rate_max">Pay Rate Max ($)</Label>
              <Input
                id="pay_rate_max"
                type="number"
                step="0.01"
                min="0"
                placeholder="Max"
                value={form.pay_rate_max}
                onChange={(e) => updateField('pay_rate_max', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay_rate_type">Pay Rate Type</Label>
              <Select
                value={form.pay_rate_type}
                onValueChange={(v) => v != null && updateField('pay_rate_type', v)}
              >
                <SelectTrigger className="w-full" id="pay_rate_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="per_contract">Per Contract</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="overtime_rate">Overtime Rate ($/hr)</Label>
            <Input
              id="overtime_rate"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 67.50"
              value={form.overtime_rate}
              onChange={(e) => updateField('overtime_rate', e.target.value)}
              className="sm:max-w-48"
            />
          </div>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="travel_reimbursement"
                checked={form.travel_reimbursement}
                onChange={(e) =>
                  updateField('travel_reimbursement', e.target.checked)
                }
                className="size-4 rounded border-input"
              />
              <Label htmlFor="travel_reimbursement">
                Travel Reimbursement
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="housing_provided"
                checked={form.housing_provided}
                onChange={(e) =>
                  updateField('housing_provided', e.target.checked)
                }
                className="size-4 rounded border-input"
              />
              <Label htmlFor="housing_provided">Housing Provided</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={form.start_date}
                onChange={(e) => updateField('start_date', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={form.end_date}
                onChange={(e) => updateField('end_date', e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="shifts_per_week">Shifts per Week</Label>
              <Input
                id="shifts_per_week"
                type="number"
                min="1"
                value={form.shifts_per_week}
                onChange={(e) =>
                  updateField('shifts_per_week', e.target.value)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hours_per_shift">Hours per Shift</Label>
              <Input
                id="hours_per_shift"
                type="number"
                step="0.5"
                min="1"
                value={form.hours_per_shift}
                onChange={(e) =>
                  updateField('hours_per_shift', e.target.value)
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requirements */}
      <Card>
        <CardHeader>
          <CardTitle>Requirements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="years_experience_min">
              Minimum Years of Experience
            </Label>
            <Input
              id="years_experience_min"
              type="number"
              min="0"
              value={form.years_experience_min}
              onChange={(e) =>
                updateField('years_experience_min', e.target.value)
              }
              className="sm:max-w-48"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Required Credentials</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add a credential"
                value={credentialInput}
                onChange={(e) => setCredentialInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addToList('required_credentials', credentialInput, () =>
                      setCredentialInput('')
                    )
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() =>
                  addToList('required_credentials', credentialInput, () =>
                    setCredentialInput('')
                  )
                }
              >
                <PlusIcon className="size-4" />
              </Button>
            </div>
            {form.required_credentials.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {form.required_credentials.map((c) => (
                  <Badge key={c} variant="secondary">
                    {c}
                    <button
                      type="button"
                      className="ml-1"
                      onClick={() =>
                        removeFromList('required_credentials', c)
                      }
                    >
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Required Certifications</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add a certification"
                value={certificationInput}
                onChange={(e) => setCertificationInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addToList(
                      'required_certifications',
                      certificationInput,
                      () => setCertificationInput('')
                    )
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() =>
                  addToList(
                    'required_certifications',
                    certificationInput,
                    () => setCertificationInput('')
                  )
                }
              >
                <PlusIcon className="size-4" />
              </Button>
            </div>
            {form.required_certifications.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {form.required_certifications.map((c) => (
                  <Badge key={c} variant="secondary">
                    {c}
                    <button
                      type="button"
                      className="ml-1"
                      onClick={() =>
                        removeFromList('required_certifications', c)
                      }
                    >
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="additional_requirements">
              Additional Requirements
            </Label>
            <Textarea
              id="additional_requirements"
              placeholder="Any other requirements or notes..."
              rows={4}
              value={form.additional_requirements}
              onChange={(e) =>
                updateField('additional_requirements', e.target.value)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3 pb-6">
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => handleSubmit('draft')}
        >
          {loading && <Loader2Icon className="size-4 animate-spin" />}
          Save as Draft
        </Button>
        <Button disabled={loading} onClick={() => handleSubmit('open')}>
          {loading && <Loader2Icon className="size-4 animate-spin" />}
          Publish Job
        </Button>
      </div>
    </div>
  )
}
