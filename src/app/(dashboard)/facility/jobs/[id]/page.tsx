import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
  UsersIcon,
  PencilIcon,
  CheckCircleIcon,
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
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .eq('facility_id', user.id)
    .single()

  if (error || !job) {
    notFound()
  }

  const typedJob = job as unknown as FacilityJobDetail

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
        href="/facility/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Back to Jobs
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {typedJob.title}
            </h1>
            <Badge variant={STATUS_VARIANT[typedJob.status] ?? 'outline'}>
              {typedJob.status.replace('_', ' ')}
            </Badge>
          </div>
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
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            render={<Link href={`/facility/jobs/new?edit=${id}`} />}
          >
            <PencilIcon className="size-4" />
            Edit
          </Button>
          <Button
            render={<Link href={`/facility/jobs/${id}/applicants`} />}
          >
            <UsersIcon className="size-4" />
            View Applicants
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardContent className="text-center">
            <p className="text-2xl font-bold">
              {typedJob.total_applicants ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Total Applicants</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="text-center">
            <p className="text-2xl font-bold">
              {typedJob.positions_filled ?? 0} / {typedJob.positions_available ?? 1}
            </p>
            <p className="text-xs text-muted-foreground">Positions Filled</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="text-center">
            <p className="text-2xl font-bold">
              {typedJob.published_at
                ? formatRelativeTime(typedJob.published_at)
                : 'Not published'}
            </p>
            <p className="text-xs text-muted-foreground">Posted</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 md:col-span-2">
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
                    <p className="text-sm font-medium">Required Specialties</p>
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
                    <p className="text-sm font-medium">Required Credentials</p>
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
                  <p className="text-sm font-medium">Additional Requirements</p>
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
                  <span className="font-medium">Overtime: </span>
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
                  <span className="font-medium">Start: </span>
                  <span className="text-muted-foreground">
                    {formatDate(typedJob.start_date)}
                  </span>
                </div>
              )}
              {typedJob.end_date && (
                <div>
                  <span className="font-medium">End: </span>
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <MapPinIcon className="size-4" />
                Location
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {location || 'Not specified'}
              {typedJob.is_remote && <p className="mt-1">Remote eligible</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
