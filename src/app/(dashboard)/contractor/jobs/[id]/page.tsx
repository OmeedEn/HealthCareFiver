import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Building,
  CheckCircle2,
  Star,
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
    <div className="space-y-6">
      <Link
        href="/contractor/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-[#62646a] hover:text-[#404145]"
      >
        <ArrowLeft className="size-4" />
        Back to jobs
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[#404145]">{typedJob.title}</h1>
          {facility && (
            <p className="flex items-center gap-1.5 text-[#62646a]">
              <Building className="size-4" />
              {facility.facility_name}
            </p>
          )}
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
            {typedJob.status === 'open' && (
              <Badge className="bg-[#e8faf1] text-[#0f8f56]">Open</Badge>
            )}
          </div>
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

          {/* Facility Info */}
          {facility && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">
                  <Building className="size-4 text-[#1dbf73]" />
                  About the Facility
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm font-semibold text-[#111827]">
                  {facility.facility_name}
                </p>
                {facility.facility_type && (
                  <p className="text-sm text-[#62646a]">
                    {facility.facility_type}
                  </p>
                )}
                {(facility.city || facility.state) && (
                  <p className="inline-flex items-center gap-1.5 text-sm text-[#62646a]">
                    <MapPin className="size-3.5" />
                    {[facility.city, facility.state].filter(Boolean).join(', ')}
                  </p>
                )}
                {facility.average_rating != null && (
                  <p className="inline-flex items-center gap-1.5 text-sm text-[#62646a]">
                    <Star className="size-3.5 text-[#1dbf73]" />
                    {facility.average_rating.toFixed(1)} / 5
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {/* Apply CTA */}
          <Card className="border-[#bcebd5] bg-[#e8faf1]">
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-1">
                <p className="text-xs font-medium tracking-wide text-[#0f8f56] uppercase">
                  Pay Rate
                </p>
                <p className="text-2xl font-bold text-[#111827]">
                  {payRange}
                  {payTypeLabel && (
                    <span className="text-base font-medium text-[#62646a]">
                      {payTypeLabel}
                    </span>
                  )}
                </p>
              </div>
              <JobDetailActions
                jobId={id}
                hasApplied={!!existingApplication}
                isSaved={isSaved}
                applicationStatus={existingApplication?.status ?? null}
                applicationDate={existingApplication?.created_at ?? null}
              />
            </CardContent>
          </Card>

          {/* Compensation Details */}
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
