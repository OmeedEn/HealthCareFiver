'use client'

import { useState } from 'react'
import Link from 'next/link'
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
import {
  Loader2,
  XIcon,
  PlusIcon,
  ArrowLeft,
  Briefcase,
  Clock,
  MapPin,
  DollarSign,
  Calendar,
  ShieldCheck,
} from 'lucide-react'

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

type ListKey =
  | 'specialties_required'
  | 'required_credentials'
  | 'required_certifications'

export default function FacilityNewJobPage() {
  const router = useRouter()
  const [form, setForm] = useState<JobFormData>(initialFormData)
  const [loading, setLoading] = useState<'draft' | 'open' | null>(null)
  const [specialtyInput, setSpecialtyInput] = useState('')
  const [credentialInput, setCredentialInput] = useState('')
  const [certificationInput, setCertificationInput] = useState('')

  const updateField = <K extends keyof JobFormData>(
    key: K,
    value: JobFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const addToList = (
    key: ListKey,
    value: string,
    clearInput: () => void,
  ) => {
    const trimmed = value.trim()
    if (!trimmed) return
    if (form[key].includes(trimmed)) return
    updateField(key, [...form[key], trimmed])
    clearInput()
  }

  const removeFromList = (key: ListKey, value: string) => {
    updateField(
      key,
      form[key].filter((v) => v !== value),
    )
  }

  const handleSubmit = async (status: 'draft' | 'open') => {
    if (!form.title.trim()) {
      toast.error('Job title is required.')
      return
    }

    setLoading(status)

    if (isDemoMode()) {
      toast.success(
        status === 'open'
          ? 'Job published successfully! (demo mode)'
          : 'Draft saved successfully! (demo mode)',
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
        pay_rate_min: form.pay_rate_min ? parseFloat(form.pay_rate_min) : null,
        pay_rate_max: form.pay_rate_max ? parseFloat(form.pay_rate_max) : null,
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
        additional_requirements: form.additional_requirements.trim() || null,
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
          : 'Draft saved successfully!',
      )
      router.push('/facility/jobs')
    } catch {
      toast.error('An unexpected error occurred.')
    } finally {
      setLoading(null)
    }
  }

  // Tiny inline "section title with brand icon" helper used by every Card.
  function SectionTitle({
    icon: Icon,
    children,
  }: {
    icon: React.ElementType
    children: React.ReactNode
  }) {
    return (
      <CardTitle className="flex items-center gap-2 text-[#404145]">
        <span className="flex size-8 items-center justify-center rounded-lg bg-[#e8faf1]">
          <Icon className="size-4 text-[#1dbf73]" />
        </span>
        {children}
      </CardTitle>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      <Link
        href="/facility/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-[#62646a] hover:text-[#404145]"
      >
        <ArrowLeft className="size-4" />
        Back to jobs
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-[#404145]">Post a new job</h1>
        <p className="text-[#62646a]">
          Fill in the details below to create a new posting. You can save as
          a draft and publish later, or publish now to start receiving
          applicants.
        </p>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <SectionTitle icon={Briefcase}>Basic information</SectionTitle>
          <CardDescription>
            The headline, role, and short summary an applicant sees first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">
              Job title <span className="text-red-600">*</span>
            </Label>
            <Input
              id="title"
              placeholder="e.g., Registered Nurse — ICU Night Shift"
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              required
            />
            <p className="text-xs text-[#62646a]">
              A clear, specific title gets 3× more qualified applicants.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the role, day-to-day responsibilities, team, and what you're looking for in an ideal candidate."
              rows={6}
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
            />
            <p className="text-xs text-[#62646a]">
              {form.description.length} characters. Aim for 150–300 words.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contractor_type">Contractor type</Label>
            <Select
              value={form.contractor_type}
              onValueChange={(v) =>
                v != null && updateField('contractor_type', v)
              }
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
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          <ChipListField
            label="Required specialties"
            placeholder="e.g., ICU, Critical Care, Trauma"
            value={specialtyInput}
            onChange={setSpecialtyInput}
            items={form.specialties_required}
            onAdd={() =>
              addToList('specialties_required', specialtyInput, () =>
                setSpecialtyInput(''),
              )
            }
            onRemove={(v) => removeFromList('specialties_required', v)}
            helper="Press Enter or click + to add. Helps the right contractors find your job."
          />
        </CardContent>
      </Card>

      {/* Job Details */}
      <Card>
        <CardHeader>
          <SectionTitle icon={Clock}>Job details</SectionTitle>
          <CardDescription>
            Type, shift, urgency, and how many spots you need to fill.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="job_type">Job type</Label>
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
              <Label htmlFor="shift_type">Shift type</Label>
              <Select
                value={form.shift_type}
                onValueChange={(v) =>
                  v != null && updateField('shift_type', v)
                }
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
              <Label htmlFor="positions_available">Positions available</Label>
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
          <SectionTitle icon={MapPin}>Location</SectionTitle>
          <CardDescription>
            Where the work happens. Mark as remote if applicable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="e.g., Los Angeles"
                value={form.city}
                onChange={(e) => updateField('city', e.target.value)}
                autoComplete="address-level2"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">State</Label>
              <Select
                value={form.state}
                onValueChange={(v) => v != null && updateField('state', v)}
              >
                <SelectTrigger className="w-full" id="state">
                  <SelectValue placeholder="Select" />
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
            <div className="space-y-1.5">
              <Label htmlFor="zip_code">ZIP code</Label>
              <Input
                id="zip_code"
                placeholder="90001"
                value={form.zip_code}
                onChange={(e) => updateField('zip_code', e.target.value)}
                pattern="[0-9]{5}"
                maxLength={5}
                autoComplete="postal-code"
              />
            </div>
          </div>

          <BrandedCheckbox
            id="is_remote"
            label="Remote eligible"
            checked={form.is_remote}
            onChange={(checked) => updateField('is_remote', checked)}
          />
        </CardContent>
      </Card>

      {/* Compensation */}
      <Card>
        <CardHeader>
          <SectionTitle icon={DollarSign}>Compensation</SectionTitle>
          <CardDescription>
            Posting a rate range gets 2× the response of jobs without one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="pay_rate_min">Pay rate min</Label>
              <CurrencyInput
                id="pay_rate_min"
                placeholder="Min"
                value={form.pay_rate_min}
                onChange={(v) => updateField('pay_rate_min', v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay_rate_max">Pay rate max</Label>
              <CurrencyInput
                id="pay_rate_max"
                placeholder="Max"
                value={form.pay_rate_max}
                onChange={(v) => updateField('pay_rate_max', v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay_rate_type">Pay rate type</Label>
              <Select
                value={form.pay_rate_type}
                onValueChange={(v) =>
                  v != null && updateField('pay_rate_type', v)
                }
              >
                <SelectTrigger className="w-full" id="pay_rate_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Per hour</SelectItem>
                  <SelectItem value="daily">Per day</SelectItem>
                  <SelectItem value="weekly">Per week</SelectItem>
                  <SelectItem value="per_contract">Per contract</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="overtime_rate">Overtime rate</Label>
            <div className="sm:max-w-48">
              <CurrencyInput
                id="overtime_rate"
                placeholder="e.g., 67.50"
                value={form.overtime_rate}
                onChange={(v) => updateField('overtime_rate', v)}
                suffix="/hr"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <BrandedCheckbox
              id="travel_reimbursement"
              label="Travel reimbursement"
              checked={form.travel_reimbursement}
              onChange={(checked) =>
                updateField('travel_reimbursement', checked)
              }
            />
            <BrandedCheckbox
              id="housing_provided"
              label="Housing provided"
              checked={form.housing_provided}
              onChange={(checked) => updateField('housing_provided', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader>
          <SectionTitle icon={Calendar}>Schedule</SectionTitle>
          <CardDescription>
            When the contract starts, ends, and the weekly cadence.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="start_date">Start date</Label>
              <Input
                id="start_date"
                type="date"
                value={form.start_date}
                onChange={(e) => updateField('start_date', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_date">End date</Label>
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
              <Label htmlFor="shifts_per_week">Shifts per week</Label>
              <Input
                id="shifts_per_week"
                type="number"
                min="1"
                placeholder="e.g., 3"
                value={form.shifts_per_week}
                onChange={(e) =>
                  updateField('shifts_per_week', e.target.value)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hours_per_shift">Hours per shift</Label>
              <Input
                id="hours_per_shift"
                type="number"
                step="0.5"
                min="1"
                placeholder="e.g., 12"
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
          <SectionTitle icon={ShieldCheck}>Requirements</SectionTitle>
          <CardDescription>
            Listing requirements upfront saves review time and avoids
            unqualified applicants.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="years_experience_min">
              Minimum years of experience
            </Label>
            <div className="sm:max-w-48">
              <Input
                id="years_experience_min"
                type="number"
                min="0"
                placeholder="e.g., 2"
                value={form.years_experience_min}
                onChange={(e) =>
                  updateField('years_experience_min', e.target.value)
                }
              />
            </div>
          </div>

          <ChipListField
            label="Required credentials"
            placeholder="e.g., RN License, NPI"
            value={credentialInput}
            onChange={setCredentialInput}
            items={form.required_credentials}
            onAdd={() =>
              addToList('required_credentials', credentialInput, () =>
                setCredentialInput(''),
              )
            }
            onRemove={(v) => removeFromList('required_credentials', v)}
          />

          <ChipListField
            label="Required certifications"
            placeholder="e.g., BLS, ACLS, PALS"
            value={certificationInput}
            onChange={setCertificationInput}
            items={form.required_certifications}
            onAdd={() =>
              addToList(
                'required_certifications',
                certificationInput,
                () => setCertificationInput(''),
              )
            }
            onRemove={(v) => removeFromList('required_certifications', v)}
          />

          <div className="space-y-1.5">
            <Label htmlFor="additional_requirements">
              Additional requirements
            </Label>
            <Textarea
              id="additional_requirements"
              placeholder="Any other requirements or notes…"
              rows={4}
              value={form.additional_requirements}
              onChange={(e) =>
                updateField('additional_requirements', e.target.value)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 -mx-4 border-t border-[#e4e5e7] bg-white px-4 py-3 sm:-mx-6 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <p className="hidden text-xs text-[#62646a] sm:block">
            {form.title.trim() ? (
              <>
                <span className="font-medium text-[#404145]">
                  Ready to {form.contractor_type ? 'publish' : 'save'}
                </span>
                {' · '}
                {form.specialties_required.length} specialties,{' '}
                {form.required_credentials.length +
                  form.required_certifications.length}{' '}
                requirements
              </>
            ) : (
              <>Job title required to save or publish</>
            )}
          </p>
          <div className="ml-auto flex items-center gap-3">
            <Button
              variant="outline"
              disabled={loading !== null}
              onClick={() => handleSubmit('draft')}
            >
              {loading === 'draft' && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Save as draft
            </Button>
            <Button
              disabled={loading !== null || !form.title.trim()}
              onClick={() => handleSubmit('open')}
              className="bg-[#1dbf73] text-white hover:bg-[#19a463]"
            >
              {loading === 'open' && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Publish job
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Reusable inline form helpers ---------------------------------------

function ChipListField({
  label,
  placeholder,
  value,
  onChange,
  items,
  onAdd,
  onRemove,
  helper,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  items: string[]
  onAdd: () => void
  onRemove: (v: string) => void
  helper?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onAdd()
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onAdd}
          aria-label={`Add ${label.toLowerCase()}`}
          className="border-[#bcebd5] text-[#0f8f56] hover:bg-[#e8faf1]"
        >
          <PlusIcon className="size-4" />
        </Button>
      </div>
      {items.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onRemove(s)}
              className="inline-flex items-center gap-1 rounded-full bg-[#e8faf1] px-3 py-1 text-xs font-medium text-[#0f8f56] hover:bg-[#d3f4e3]"
            >
              {s}
              <XIcon className="size-3" />
            </button>
          ))}
        </div>
      ) : helper ? (
        <p className="text-xs text-[#62646a]">{helper}</p>
      ) : null}
    </div>
  )
}

function BrandedCheckbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors ${
        checked
          ? 'border-[#bcebd5] bg-[#e8faf1] text-[#0f8f56]'
          : 'border-[#e4e5e7] bg-white text-[#404145] hover:bg-[#f7f7f7]'
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 cursor-pointer accent-[#1dbf73]"
      />
      <span className="font-medium">{label}</span>
    </label>
  )
}

function CurrencyInput({
  id,
  placeholder,
  value,
  onChange,
  suffix,
}: {
  id: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  suffix?: string
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6b7280]">
        $
      </span>
      <Input
        id={id}
        type="number"
        step="0.01"
        min="0"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={suffix ? 'pl-7 pr-12' : 'pl-7'}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#6b7280]">
          {suffix}
        </span>
      )}
    </div>
  )
}
