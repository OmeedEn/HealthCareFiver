'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatRelativeTime } from '@/lib/utils/format'
import { JOB_TYPE_LABELS, SHIFT_TYPE_LABELS } from '@/lib/utils/constants'
import {
  MapPinIcon,
  ClockIcon,
  UsersIcon,
  BookmarkIcon,
  DollarSignIcon,
} from 'lucide-react'

export interface JobCardData {
  id: string
  title: string
  facility_name: string | null
  city: string | null
  state: string | null
  pay_rate_min: number | null
  pay_rate_max: number | null
  pay_rate_type: string | null
  job_type: string | null
  shift_type: string | null
  urgency: string | null
  published_at: string | null
  created_at: string
  total_applicants: number | null
  is_remote: boolean | null
}

interface JobCardProps {
  job: JobCardData
  showSave?: boolean
  onSave?: (jobId: string) => void
  isSaved?: boolean
  linkPrefix?: string
}

function getUrgencyVariant(urgency: string | null) {
  switch (urgency) {
    case 'critical':
      return 'destructive' as const
    case 'high':
      return 'secondary' as const
    default:
      return 'outline' as const
  }
}

export function JobCard({
  job,
  showSave = false,
  onSave,
  isSaved = false,
  linkPrefix = '/contractor/jobs',
}: JobCardProps) {
  const payRange =
    job.pay_rate_min && job.pay_rate_max
      ? `${formatCurrency(job.pay_rate_min)} - ${formatCurrency(job.pay_rate_max)}`
      : job.pay_rate_min
        ? `From ${formatCurrency(job.pay_rate_min)}`
        : job.pay_rate_max
          ? `Up to ${formatCurrency(job.pay_rate_max)}`
          : null

  const payTypeLabel = job.pay_rate_type
    ? `/${job.pay_rate_type === 'per_contract' ? 'contract' : job.pay_rate_type}`
    : ''

  const location = [job.city, job.state].filter(Boolean).join(', ')
  const postedDate = job.published_at || job.created_at

  return (
    <Card className="relative rounded-md border-[#e4e5e7] bg-white transition hover:border-[#1dbf73] hover:shadow-lg">
      <Link href={`${linkPrefix}/${job.id}`} className="absolute inset-0 z-0" />
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="line-clamp-1 text-[#404145]">{job.title}</CardTitle>
            {job.facility_name && (
              <p className="mt-0.5 text-sm font-semibold text-[#74767e]">
                {job.facility_name}
              </p>
            )}
          </div>
          {showSave && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="relative z-10 shrink-0"
              onClick={(e) => {
                e.preventDefault()
                onSave?.(job.id)
              }}
            >
              <BookmarkIcon
                className={isSaved ? 'fill-current' : ''}
              />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {job.job_type && (
            <Badge variant="secondary">
              {JOB_TYPE_LABELS[job.job_type] ?? job.job_type}
            </Badge>
          )}
          {job.shift_type && (
            <Badge variant="outline">
              {SHIFT_TYPE_LABELS[job.shift_type] ?? job.shift_type}
            </Badge>
          )}
          {job.urgency && job.urgency !== 'normal' && (
            <Badge variant={getUrgencyVariant(job.urgency)}>
              {job.urgency === 'critical' ? 'Critical' : 'High Priority'}
            </Badge>
          )}
          {job.is_remote && <Badge variant="outline">Remote</Badge>}
        </div>

        <div className="space-y-1.5 text-sm text-muted-foreground">
          {location && (
            <div className="flex items-center gap-1.5">
              <MapPinIcon className="size-3.5 shrink-0" />
              <span>{location}</span>
            </div>
          )}
          {payRange && (
            <div className="flex items-center gap-1.5">
              <DollarSignIcon className="size-3.5 shrink-0" />
              <span>
                {payRange}
                {payTypeLabel}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ClockIcon className="size-3.5 shrink-0" />
              <span>{formatRelativeTime(postedDate)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <UsersIcon className="size-3.5 shrink-0" />
              <span>{job.total_applicants ?? 0} applicants</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
