import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatDate, formatRelativeTime } from '@/lib/utils/format'
import {
  CONTRACTOR_TYPE_LABELS,
  JOB_TYPE_LABELS,
} from '@/lib/utils/constants'
import { PlusIcon, UsersIcon, EyeIcon, PencilIcon, XCircleIcon } from 'lucide-react'
import { FacilityJobsTabs } from './facility-jobs-tabs'

interface FacilityJob {
  id: string
  title: string
  status: string
  contractor_type: string | null
  job_type: string | null
  total_applicants: number | null
  positions_available: number | null
  positions_filled: number | null
  published_at: string | null
  created_at: string
  urgency: string | null
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  open: 'default',
  in_progress: 'secondary',
  completed: 'outline',
  draft: 'outline',
  filled: 'secondary',
  cancelled: 'destructive',
}

export default async function FacilityJobsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: jobs, error } = await supabase
    .from('jobs')
    .select(
      'id, title, status, contractor_type, job_type, total_applicants, positions_available, positions_filled, published_at, created_at, urgency'
    )
    .eq('facility_id', user.id)
    .order('created_at', { ascending: false })

  const allJobs = (jobs ?? []) as unknown as FacilityJob[]

  const tabCounts = {
    all: allJobs.length,
    open: allJobs.filter((j) => j.status === 'open').length,
    in_progress: allJobs.filter((j) => j.status === 'in_progress').length,
    completed: allJobs.filter((j) => j.status === 'completed').length,
    draft: allJobs.filter((j) => j.status === 'draft').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Jobs</h1>
          <p className="text-muted-foreground">
            View and manage your job postings
          </p>
        </div>
        <Button render={<Link href="/facility/jobs/new" />}>
          <PlusIcon className="size-4" />
          Post New Job
        </Button>
      </div>

      <FacilityJobsTabs tabCounts={tabCounts}>
        {(status: string) => {
          const filtered =
            status === 'all'
              ? allJobs
              : allJobs.filter((j) => j.status === status)

          if (filtered.length === 0) {
            return (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">
                  No {status === 'all' ? '' : status.replace('_', ' ')} jobs
                  found.
                </p>
              </div>
            )
          }

          return (
            <div className="space-y-3">
              {filtered.map((job) => (
                <Card key={job.id} size="sm">
                  <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/facility/jobs/${job.id}`}
                          className="font-medium hover:underline"
                        >
                          {job.title}
                        </Link>
                        <Badge
                          variant={STATUS_VARIANT[job.status] ?? 'outline'}
                        >
                          {job.status.replace('_', ' ')}
                        </Badge>
                        {job.urgency && job.urgency !== 'normal' && (
                          <Badge
                            variant={
                              job.urgency === 'critical'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {job.urgency}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {job.contractor_type && (
                          <span>
                            {CONTRACTOR_TYPE_LABELS[job.contractor_type] ??
                              job.contractor_type}
                          </span>
                        )}
                        {job.job_type && (
                          <span>
                            {JOB_TYPE_LABELS[job.job_type] ?? job.job_type}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <UsersIcon className="size-3" />
                          {job.total_applicants ?? 0} applicants
                        </span>
                        {job.positions_available != null && (
                          <span>
                            {job.positions_filled ?? 0}/
                            {job.positions_available} filled
                          </span>
                        )}
                        <span>
                          {job.published_at
                            ? `Posted ${formatRelativeTime(job.published_at)}`
                            : `Created ${formatRelativeTime(job.created_at)}`}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        render={
                          <Link href={`/facility/jobs/${job.id}`} />
                        }
                      >
                        <EyeIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        render={
                          <Link
                            href={`/facility/jobs/${job.id}/applicants`}
                          />
                        }
                      >
                        <UsersIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        render={
                          <Link
                            href={`/facility/jobs/new?edit=${job.id}`}
                          />
                        }
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        }}
      </FacilityJobsTabs>
    </div>
  )
}
