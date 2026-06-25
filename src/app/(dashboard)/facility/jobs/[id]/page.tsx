import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isDemoMode, DEMO_JOBS } from '@/lib/demo/data'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils/format'
import {
  CONTRACTOR_TYPE_LABELS,
  JOB_TYPE_LABELS,
  SHIFT_TYPE_LABELS,
  CREDENTIAL_TYPE_LABELS,
} from '@/lib/utils/constants'
import {
  ArrowLeft,
  MapPin,
  DollarSign,
  Calendar,
  Users,
  Briefcase,
  Pencil,
  CheckCircle2,
} from 'lucide-react'

interface FacilityJobDetail {
  id: string
  title: string
  description: string | null
  contractor_type: string | null
  specialties_required: string[] | null
  job_type: string | null
  shift_type: string | null
  status: string
  city: string | null
  state: string | null
  zip_code: string | null
  is_remote: boolean | null
  pay_rate_min: number | null
  pay_rate_max: number | null
  pay_rate_type: string | null
  overtime_rate: number | null
  travel_reimbursement: boolean | null
  housing_provided: boolean | null
  start_date: string | null
  end_date: string | null
  shifts_per_week: number | null
  hours_per_shift: number | null
  years_experience_min: number | null
  required_credentials: string[] | null
  required_certifications: string[] | null
  additional_requirements: string | null
  total_applicants: number | null
  positions_available: number | null
  positions_filled: number | null
  urgency: string | null
  published_at: string | null
  created_at: string
  facility_profiles: {
    id: string
    facility_name: string
    facility_type: string | null
    city: string | null
    state: string | null
    average_rating: number | null
  } | null
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  open: 'default',
  in_progress: 'secondary',
  completed: 'outline',
  draft: 'outline',
  filled: 'secondary',
  cancelled: 'destructive',
}

export default async function FacilityJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let typedJob: FacilityJobDetail

  if (isDemoMode()) {
    const demoJob = DEMO_JOBS.find((j) => j.id === id)
    if (!demoJob) notFound()
    // Demo fixtures use a flat `facility` object; the page expects
    // `facility_profiles` with the same fields plus id + facility_type.
    // required_certifications doesn't exist on the fixtures.
    typedJob = {
      ...demoJob,
      required_certifications: null,
      facility_profiles: demoJob.facility
        ? {
            id: demoJob.facility_id,
            facility_name: demoJob.facility.facility_name,
            facility_type: null,
            city: demoJob.facility.city,
            state: demoJob.facility.state,
            average_rating: demoJob.facility.average_rating,
          }
        : null,
    } as unknown as FacilityJobDetail
  } else {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: job, error } = await supabase
      .from('jobs')
      .select(
        '*, facility_profiles(id, facility_name, facility_type, city, state, average_rating)'
      )
      .eq('id', id)
      .eq('facility_id', user.id)
      .single()

    if (error || !job) {
      notFound()
    }

    typedJob = job as unknown as FacilityJobDetail
  }

  const location = [typedJob.city, typedJob.state, typedJob.zip_code]
    .filter(Boolean)
    .join(', ')

  const payRange =
    typedJob.pay_rate_min && typedJob.pay_rate_max
      ? `${formatCurrency(typedJob.pay_rate_min)} - ${formatCurrency(typedJob.pay_rate_max)}`
      : typedJob.pay_rate_min
        ? `From ${formatCurrency(typedJob.pay_rate_min)}`
        : typedJob.pay_rate_max
          ? `Up to ${formatCurrency(typedJob.pay_rate_max)}`
          : 'Not specified'

  const payTypeLabel = typedJob.pay_rate_type
    ? `/${typedJob.pay_rate_type === 'per_contract' ? 'contract' : typedJob.pay_rate_type}`
    : ''

  return (
    <div className="space-y-6">
      <Link
        href="/facility/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-[#62646a] hover:text-[#404145]"
      >
        <ArrowLeft className="size-4" />
        Back to jobs
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-[#404145]">
              {typedJob.title}
            </h1>
            <Badge variant={STATUS_VARIANT[typedJob.status] ?? 'outline'}>
              {typedJob.status.replace('_', ' ')}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[#62646a]">
            {location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" />
                {location}
              </span>
            )}
            {typedJob.published_at && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-4" />
                Posted {formatRelativeTime(typedJob.published_at)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {typedJob.job_type && (
              <Badge variant="outline">
                {JOB_TYPE_LABELS[typedJob.job_type] ?? typedJob.job_type}
              </Badge>
            )}
            {typedJob.shift_type && (
              <Badge variant="outline">
                {SHIFT_TYPE_LABELS[typedJob.shift_type] ?? typedJob.shift_type}
              </Badge>
            )}
            {typedJob.urgency && typedJob.urgency !== 'normal' && (
              <Badge
                variant={
                  typedJob.urgency === 'critical' ? 'destructive' : 'secondary'
                }
              >
                {typedJob.urgency === 'critical'
                  ? 'Critical'
                  : 'High Priority'}
              </Badge>
            )}
            {typedJob.is_remote && <Badge variant="outline">Remote</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            render={<Link href={`/facility/jobs/new?edit=${id}`} />}
          >
            <Pencil className="size-4" />
            Edit
          </Button>
          <Button
            className="bg-[#1dbf73] text-white hover:bg-[#19a463]"
            render={<Link href={`/facility/jobs/${id}/applicants`} />}
          >
            <Users className="size-4" />
            View Applicants
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          {typedJob.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-[#62646a]">
                  {typedJob.description}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Requirements */}
          <Card>
            <CardHeader>
              <CardTitle>Requirements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {typedJob.contractor_type && (
                <div className="space-y-1">
                  <p className="text-xs text-[#6b7280]">Contractor Type</p>
                  <p className="text-sm text-[#111827]">
                    {CONTRACTOR_TYPE_LABELS[typedJob.contractor_type] ??
                      typedJob.contractor_type}
                  </p>
                </div>
              )}
              {typedJob.years_experience_min != null && (
                <div className="space-y-1">
                  <p className="text-xs text-[#6b7280]">Minimum Experience</p>
                  <p className="text-sm text-[#111827]">
                    {typedJob.years_experience_min} year
                    {typedJob.years_experience_min !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
              {typedJob.specialties_required &&
                typedJob.specialties_required.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-[#6b7280]">
                      Required Specialties
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {typedJob.specialties_required.map((s) => (
                        <Badge key={s} variant="outline">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              {typedJob.required_credentials &&
                typedJob.required_credentials.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-[#6b7280]">
                      Required Credentials
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {typedJob.required_credentials.map((c) => (
                        <Badge key={c} variant="outline">
                          {CREDENTIAL_TYPE_LABELS[c] ?? c}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              {typedJob.required_certifications &&
                typedJob.required_certifications.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-[#6b7280]">
                      Required Certifications
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {typedJob.required_certifications.map((c) => (
                        <Badge key={c} variant="outline">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              {typedJob.additional_requirements && (
                <div className="space-y-1">
                  <p className="text-xs text-[#6b7280]">
                    Additional Requirements
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-[#62646a]">
                    {typedJob.additional_requirements}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <Calendar className="size-4 text-[#1dbf73]" />
                Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {typedJob.start_date && (
                  <div className="space-y-1">
                    <dt className="text-xs text-[#6b7280]">Start Date</dt>
                    <dd className="text-sm text-[#111827]">
                      {formatDate(typedJob.start_date)}
                    </dd>
                  </div>
                )}
                {typedJob.end_date && (
                  <div className="space-y-1">
                    <dt className="text-xs text-[#6b7280]">End Date</dt>
                    <dd className="text-sm text-[#111827]">
                      {formatDate(typedJob.end_date)}
                    </dd>
                  </div>
                )}
                {typedJob.shifts_per_week != null && (
                  <div className="space-y-1">
                    <dt className="text-xs text-[#6b7280]">Shifts / Week</dt>
                    <dd className="text-sm text-[#111827]">
                      {typedJob.shifts_per_week}
                    </dd>
                  </div>
                )}
                {typedJob.hours_per_shift != null && (
                  <div className="space-y-1">
                    <dt className="text-xs text-[#6b7280]">Hours / Shift</dt>
                    <dd className="text-sm text-[#111827]">
                      {typedJob.hours_per_shift}
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {/* Applicants summary CTA */}
          <Card className="border-[#bcebd5] bg-[#e8faf1]">
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-1">
                <p className="text-xs font-medium tracking-wide text-[#0f8f56] uppercase">
                  Applicants
                </p>
                <p className="text-2xl font-bold text-[#111827]">
                  {typedJob.total_applicants ?? 0}
                  <span className="ml-2 text-base font-medium text-[#62646a]">
                    total
                  </span>
                </p>
                <p className="text-sm text-[#62646a]">
                  {typedJob.positions_filled ?? 0} /{' '}
                  {typedJob.positions_available ?? 1} positions filled
                </p>
              </div>
              <Button
                className="w-full bg-[#1dbf73] text-white hover:bg-[#19a463]"
                render={<Link href={`/facility/jobs/${id}/applicants`} />}
              >
                <Users className="size-4" />
                Review Applicants
              </Button>
              <Button
                variant="outline"
                className="w-full"
                render={<Link href={`/facility/jobs/new?edit=${id}`} />}
              >
                <Pencil className="size-4" />
                Edit Job
              </Button>
            </CardContent>
          </Card>

          {/* Compensation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <DollarSign className="size-4 text-[#1dbf73]" />
                Compensation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[#6b7280]">Pay Rate</span>
                <span className="text-[#111827]">
                  {payRange}
                  {payTypeLabel}
                </span>
              </div>
              {typedJob.overtime_rate != null && (
                <div className="flex items-center justify-between">
                  <span className="text-[#6b7280]">Overtime Rate</span>
                  <span className="text-[#111827]">
                    {formatCurrency(typedJob.overtime_rate)}/hr
                  </span>
                </div>
              )}
              {typedJob.travel_reimbursement && (
                <div className="flex items-center gap-1.5 text-[#62646a]">
                  <CheckCircle2 className="size-3.5 text-[#1dbf73]" />
                  Travel Reimbursement
                </div>
              )}
              {typedJob.housing_provided && (
                <div className="flex items-center gap-1.5 text-[#62646a]">
                  <CheckCircle2 className="size-3.5 text-[#1dbf73]" />
                  Housing Provided
                </div>
              )}
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <MapPin className="size-4 text-[#1dbf73]" />
                Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-[#62646a]">
              <p>{location || 'Location not specified'}</p>
              {typedJob.is_remote && (
                <p className="text-[#0f8f56]">Remote eligible</p>
              )}
            </CardContent>
          </Card>

          {/* Job Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <Briefcase className="size-4 text-[#1dbf73]" />
                Job Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[#6b7280]">
                  <Users className="size-3.5" />
                  Applicants
                </span>
                <span className="text-[#111827]">
                  {typedJob.total_applicants ?? 0}
                </span>
              </div>
              {typedJob.positions_available != null && (
                <div className="flex items-center justify-between">
                  <span className="text-[#6b7280]">Positions</span>
                  <span className="text-[#111827]">
                    {typedJob.positions_filled ?? 0} /{' '}
                    {typedJob.positions_available} filled
                  </span>
                </div>
              )}
              {typedJob.published_at && (
                <div className="flex items-center justify-between">
                  <span className="text-[#6b7280]">Posted</span>
                  <span className="text-[#111827]">
                    {formatRelativeTime(typedJob.published_at)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
