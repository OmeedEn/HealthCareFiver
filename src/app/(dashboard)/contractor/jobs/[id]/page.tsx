import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils/format'
import {
  CONTRACTOR_TYPE_LABELS,
  JOB_TYPE_LABELS,
  SHIFT_TYPE_LABELS,
  CREDENTIAL_TYPE_LABELS,
} from '@/lib/utils/constants'
import {
  ArrowLeftIcon,
  MapPinIcon,
  DollarSignIcon,
  CalendarIcon,
  ClockIcon,
  UsersIcon,
  BriefcaseIcon,
  BuildingIcon,
  CheckCircleIcon,
} from 'lucide-react'
import { JobDetailActions } from './job-detail-actions'

interface JobDetail {
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

export default async function ContractorJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: job, error } = await supabase
    .from('jobs')
    .select(
      '*, facility_profiles(id, facility_name, facility_type, city, state, average_rating)'
    )
    .eq('id', id)
    .single()

  if (error || !job) {
    notFound()
  }

  const typedJob = job as unknown as JobDetail

  // Check if user has already applied
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let existingApplication: {
    id: string
    status: string
    created_at: string
  } | null = null

  if (user) {
    const { data } = await supabase
      .from('job_applications')
      .select('id, status, created_at')
      .eq('job_id', id)
      .eq('contractor_id', user.id)
      .maybeSingle()

    existingApplication = data
  }

  // Check if job is saved
  let isSaved = false
  if (user) {
    const { data } = await supabase
      .from('saved_jobs')
      .select('job_id')
      .eq('job_id', id)
      .eq('contractor_id', user.id)
      .maybeSingle()

    isSaved = !!data
  }

  const facility = typedJob.facility_profiles
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
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/contractor/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Back to Job Search
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{typedJob.title}</h1>
          {facility && (
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <BuildingIcon className="size-4" />
              {facility.facility_name}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {typedJob.job_type && (
              <Badge variant="secondary">
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

        <JobDetailActions
          jobId={id}
          hasApplied={!!existingApplication}
          isSaved={isSaved}
          applicationStatus={existingApplication?.status ?? null}
          applicationDate={existingApplication?.created_at ?? null}
        />
      </div>

      <Separator />

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 md:col-span-2">
          {/* Description */}
          {typedJob.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
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
                <div>
                  <p className="text-sm font-medium">Contractor Type</p>
                  <p className="text-sm text-muted-foreground">
                    {CONTRACTOR_TYPE_LABELS[typedJob.contractor_type] ??
                      typedJob.contractor_type}
                  </p>
                </div>
              )}
              {typedJob.years_experience_min != null && (
                <div>
                  <p className="text-sm font-medium">Minimum Experience</p>
                  <p className="text-sm text-muted-foreground">
                    {typedJob.years_experience_min} year
                    {typedJob.years_experience_min !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
              {typedJob.specialties_required &&
                typedJob.specialties_required.length > 0 && (
                  <div>
                    <p className="text-sm font-medium">
                      Required Specialties
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
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
                  <div>
                    <p className="text-sm font-medium">
                      Required Credentials
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
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
                  <div>
                    <p className="text-sm font-medium">
                      Required Certifications
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {typedJob.required_certifications.map((c) => (
                        <Badge key={c} variant="outline">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              {typedJob.additional_requirements && (
                <div>
                  <p className="text-sm font-medium">
                    Additional Requirements
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {typedJob.additional_requirements}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Compensation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <DollarSignIcon className="size-4" />
                Compensation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Pay Rate: </span>
                <span className="text-muted-foreground">
                  {payRange}
                  {payTypeLabel}
                </span>
              </div>
              {typedJob.overtime_rate != null && (
                <div>
                  <span className="font-medium">Overtime Rate: </span>
                  <span className="text-muted-foreground">
                    {formatCurrency(typedJob.overtime_rate)}/hr
                  </span>
                </div>
              )}
              {typedJob.travel_reimbursement && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircleIcon className="size-3.5 text-green-600" />
                  Travel Reimbursement
                </div>
              )}
              {typedJob.housing_provided && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircleIcon className="size-3.5 text-green-600" />
                  Housing Provided
                </div>
              )}
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <CalendarIcon className="size-4" />
                Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {typedJob.start_date && (
                <div>
                  <span className="font-medium">Start Date: </span>
                  <span className="text-muted-foreground">
                    {formatDate(typedJob.start_date)}
                  </span>
                </div>
              )}
              {typedJob.end_date && (
                <div>
                  <span className="font-medium">End Date: </span>
                  <span className="text-muted-foreground">
                    {formatDate(typedJob.end_date)}
                  </span>
                </div>
              )}
              {typedJob.shifts_per_week != null && (
                <div>
                  <span className="font-medium">Shifts/Week: </span>
                  <span className="text-muted-foreground">
                    {typedJob.shifts_per_week}
                  </span>
                </div>
              )}
              {typedJob.hours_per_shift != null && (
                <div>
                  <span className="font-medium">Hours/Shift: </span>
                  <span className="text-muted-foreground">
                    {typedJob.hours_per_shift}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <MapPinIcon className="size-4" />
                Location
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {location || 'Location not specified'}
              {typedJob.is_remote && <p className="mt-1">Remote eligible</p>}
            </CardContent>
          </Card>

          {/* Job Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <BriefcaseIcon className="size-4" />
                Job Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-1.5">
                <UsersIcon className="size-3.5" />
                <span>{typedJob.total_applicants ?? 0} applicants</span>
              </div>
              {typedJob.positions_available != null && (
                <div>
                  <span className="font-medium">Positions: </span>
                  <span className="text-muted-foreground">
                    {typedJob.positions_filled ?? 0} /{' '}
                    {typedJob.positions_available} filled
                  </span>
                </div>
              )}
              {typedJob.published_at && (
                <div>
                  <span className="font-medium">Posted: </span>
                  <span className="text-muted-foreground">
                    {formatRelativeTime(typedJob.published_at)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Facility Info */}
          {facility && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">
                  <BuildingIcon className="size-4" />
                  Facility
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium">{facility.facility_name}</p>
                {facility.facility_type && (
                  <p className="text-muted-foreground">
                    {facility.facility_type}
                  </p>
                )}
                {(facility.city || facility.state) && (
                  <p className="text-muted-foreground">
                    {[facility.city, facility.state].filter(Boolean).join(', ')}
                  </p>
                )}
                {facility.average_rating != null && (
                  <p className="text-muted-foreground">
                    Rating: {facility.average_rating.toFixed(1)} / 5
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
