import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatRelativeTime } from '@/lib/utils/format'
import {
  CONTRACTOR_TYPE_LABELS,
  JOB_TYPE_LABELS,
} from '@/lib/utils/constants'
import {
  PlusIcon,
  UsersIcon,
  EyeIcon,
  PencilIcon,
  BriefcaseIcon,
} from 'lucide-react'
import { isDemoMode, DEMO_JOBS, DEMO_FACILITY } from '@/lib/demo/data'
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

// Brand-aligned status pill classes (Tailwind only, no inline styles).
const STATUS_PILL: Record<string, string> = {
  open: 'border-[#bcebd5] bg-[#e8faf1] text-[#0f8f56]',
  in_progress: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]',
  completed: 'border-[#e5e7eb] bg-[#f3f4f6] text-[#404145]',
  draft: 'border-[#e5e7eb] bg-[#f9fafb] text-[#62646a]',
  filled: 'border-[#e5e7eb] bg-[#f3f4f6] text-[#404145]',
  cancelled: 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]',
}

const URGENCY_PILL: Record<string, string> = {
  high: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  critical: 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]',
  low: 'border-[#e5e7eb] bg-[#f9fafb] text-[#62646a]',
}

function loadDemoJobs(): FacilityJob[] {
  const filtered = (DEMO_JOBS as unknown as Array<Record<string, unknown>>)
    .filter((j) => j.facility_id === DEMO_FACILITY.id)
  const source =
    filtered.length > 0
      ? filtered
      : (DEMO_JOBS as unknown as Array<Record<string, unknown>>).slice(0, 5)
  return source.map((j) => ({
    id: j.id as string,
    title: j.title as string,
    status: (j.status as string) ?? 'open',
    contractor_type: (j.contractor_type as string | null) ?? null,
    job_type: (j.job_type as string | null) ?? null,
    total_applicants: (j.total_applicants as number | null) ?? null,
    positions_available: (j.positions_available as number | null) ?? null,
    positions_filled: (j.positions_filled as number | null) ?? null,
    published_at: (j.published_at as string | null) ?? null,
    created_at: (j.created_at as string) ?? new Date().toISOString(),
    urgency: (j.urgency as string | null) ?? null,
  }))
}

export default async function FacilityJobsPage() {
  let allJobs: FacilityJob[] = []

  if (isDemoMode()) {
    allJobs = loadDemoJobs()
  } else {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: jobs } = await supabase
      .from('jobs')
      .select(
        'id, title, status, contractor_type, job_type, total_applicants, positions_available, positions_filled, published_at, created_at, urgency'
      )
      .eq('facility_id', user.id)
      .order('created_at', { ascending: false })

    allJobs = (jobs ?? []) as unknown as FacilityJob[]
  }

  const tabCounts = {
    all: allJobs.length,
    open: allJobs.filter((j) => j.status === 'open').length,
    in_progress: allJobs.filter((j) => j.status === 'in_progress').length,
    completed: allJobs.filter((j) => j.status === 'completed').length,
    draft: allJobs.filter((j) => j.status === 'draft').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#404145]">Manage Jobs</h1>
          <p className="text-[#62646a]">
            View and manage your job postings
          </p>
        </div>
        <Button
          className="bg-[#1dbf73] text-white hover:bg-[#19a463]"
          render={<Link href="/facility/jobs/new" />}
        >
          <PlusIcon className="size-4" />
          Post New Job
        </Button>
      </div>

      <FacilityJobsTabs
        tabCounts={tabCounts}
        content={{
          all: renderJobsForStatus('all', allJobs),
          open: renderJobsForStatus('open', allJobs.filter((j) => j.status === 'open')),
          in_progress: renderJobsForStatus('in_progress', allJobs.filter((j) => j.status === 'in_progress')),
          completed: renderJobsForStatus('completed', allJobs.filter((j) => j.status === 'completed')),
          draft: renderJobsForStatus('draft', allJobs.filter((j) => j.status === 'draft')),
        }}
      />
    </div>
  )
}

function renderJobsForStatus(status: string, filtered: FacilityJob[]) {
  if (filtered.length === 0) {
    const label = status === 'all' ? '' : status.replace('_', ' ')
    return (
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-[#e8faf1]">
              <BriefcaseIcon className="size-6 text-[#1dbf73]" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-[#404145]">
              No {label} jobs yet
            </h3>
            <p className="mt-1 text-sm text-[#62646a]">
              {status === 'all'
                ? 'Post your first job to start receiving applicants.'
                : 'Jobs with this status will appear here.'}
            </p>
            {status === 'all' && (
              <Button
                className="mt-4 bg-[#1dbf73] text-white hover:bg-[#19a463]"
                render={<Link href="/facility/jobs/new" />}
              >
                <PlusIcon className="size-4" />
                Post New Job
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {filtered.map((job) => {
        const statusClass =
          STATUS_PILL[job.status] ??
          'border-[#e5e7eb] bg-[#f9fafb] text-[#62646a]'
        const urgencyClass =
          job.urgency && job.urgency !== 'normal'
            ? URGENCY_PILL[job.urgency] ??
              'border-[#e5e7eb] bg-[#f9fafb] text-[#62646a]'
            : null

        return (
          <Card key={job.id}>
            <CardContent className="flex h-full flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/facility/jobs/${job.id}`}
                  className="line-clamp-2 text-base font-semibold text-[#404145] hover:text-[#1dbf73] hover:underline"
                >
                  {job.title}
                </Link>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  <Badge
                    variant="outline"
                    className={`${statusClass} text-[11px] font-medium capitalize`}
                  >
                    {job.status.replace('_', ' ')}
                  </Badge>
                  {urgencyClass && (
                    <Badge
                      variant="outline"
                      className={`${urgencyClass} text-[11px] font-medium capitalize`}
                    >
                      {job.urgency}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#6b7280]">
                {job.contractor_type && (
                  <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[#404145]">
                    {CONTRACTOR_TYPE_LABELS[job.contractor_type] ??
                      job.contractor_type}
                  </span>
                )}
                {job.job_type && (
                  <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[#404145]">
                    {JOB_TYPE_LABELS[job.job_type] ?? job.job_type}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#62646a]">
                <span className="inline-flex items-center gap-1">
                  <UsersIcon className="size-3.5 text-[#1dbf73]" />
                  <span className="font-medium text-[#404145]">
                    {job.total_applicants ?? 0}
                  </span>
                  applicants
                </span>
                {job.positions_available != null && (
                  <span>
                    <span className="font-medium text-[#404145]">
                      {job.positions_filled ?? 0}/{job.positions_available}
                    </span>{' '}
                    filled
                  </span>
                )}
                <span>
                  {job.published_at
                    ? `Posted ${formatRelativeTime(job.published_at)}`
                    : `Created ${formatRelativeTime(job.created_at)}`}
                </span>
              </div>

              <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#e5e7eb] pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[#62646a] hover:bg-[#e8faf1] hover:text-[#0f8f56]"
                  render={<Link href={`/facility/jobs/${job.id}`} />}
                >
                  <EyeIcon className="size-4" />
                  View
                </Button>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#62646a] hover:bg-[#e8faf1] hover:text-[#0f8f56]"
                    render={
                      <Link href={`/facility/jobs/${job.id}/applicants`} />
                    }
                  >
                    <UsersIcon className="size-4" />
                    Applicants
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Edit job"
                    className="text-[#62646a] hover:bg-[#e8faf1] hover:text-[#0f8f56]"
                    render={
                      <Link href={`/facility/jobs/new?edit=${job.id}`} />
                    }
                  >
                    <PencilIcon className="size-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
