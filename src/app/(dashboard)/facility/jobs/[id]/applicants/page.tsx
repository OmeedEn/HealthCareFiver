import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils/format'
import { CONTRACTOR_TYPE_LABELS } from '@/lib/utils/constants'
import { ArrowLeftIcon, StarIcon } from 'lucide-react'
import { ApplicantActions } from './applicant-actions'

interface Applicant {
  id: string
  status: string
  cover_letter: string | null
  proposed_rate: number | null
  available_start_date: string | null
  created_at: string
  contractor_profiles: {
    id: string
    first_name: string | null
    last_name: string | null
    contractor_type: string | null
    years_experience: number | null
    average_rating: number | null
    city: string | null
    state: string | null
  } | null
}

const STATUS_LABELS: Record<string, string> = {
  applied: 'Applied',
  shortlisted: 'Shortlisted',
  interviewing: 'Interviewing',
  offered: 'Offered',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  applied: 'outline',
  shortlisted: 'secondary',
  interviewing: 'secondary',
  offered: 'default',
  accepted: 'default',
  rejected: 'destructive',
  withdrawn: 'outline',
}

export default async function ApplicantsPage({
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

  // Verify job belongs to this facility
  const { data: job } = await supabase
    .from('jobs')
    .select('id, title')
    .eq('id', id)
    .eq('facility_id', user.id)
    .single()

  if (!job) {
    notFound()
  }

  // Fetch applicants
  const { data: applicants } = await supabase
    .from('job_applications')
    .select(
      'id, status, cover_letter, proposed_rate, available_start_date, created_at, contractor_profiles(id, first_name, last_name, contractor_type, years_experience, average_rating, city, state)'
    )
    .eq('job_id', id)
    .order('created_at', { ascending: false })

  const typedApplicants = (applicants ?? []) as unknown as Applicant[]

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href={`/facility/jobs/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Back to Job
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Applicants</h1>
        <p className="text-muted-foreground">
          {job.title} &mdash; {typedApplicants.length} applicant
          {typedApplicants.length !== 1 ? 's' : ''}
        </p>
      </div>

      {typedApplicants.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            No applications received yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {typedApplicants.map((applicant) => {
            const profile = applicant.contractor_profiles
            const name = profile
              ? [profile.first_name, profile.last_name]
                  .filter(Boolean)
                  .join(' ') || 'Unknown'
              : 'Unknown'
            const location = profile
              ? [profile.city, profile.state].filter(Boolean).join(', ')
              : null

            return (
              <Card key={applicant.id}>
                <CardContent className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {profile ? (
                          <Link
                            href={`/facility/contractors/${profile.id}`}
                            className="font-medium hover:underline"
                          >
                            {name}
                          </Link>
                        ) : (
                          <span className="font-medium">{name}</span>
                        )}
                        <Badge
                          variant={
                            STATUS_VARIANT[applicant.status] ?? 'outline'
                          }
                        >
                          {STATUS_LABELS[applicant.status] ?? applicant.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {profile?.contractor_type && (
                          <span>
                            {CONTRACTOR_TYPE_LABELS[
                              profile.contractor_type
                            ] ?? profile.contractor_type}
                          </span>
                        )}
                        {profile?.years_experience != null && (
                          <span>
                            {profile.years_experience} yr
                            {profile.years_experience !== 1 ? 's' : ''}{' '}
                            experience
                          </span>
                        )}
                        {profile?.average_rating != null && (
                          <span className="flex items-center gap-0.5">
                            <StarIcon className="size-3 fill-yellow-400 text-yellow-400" />
                            {profile.average_rating.toFixed(1)}
                          </span>
                        )}
                        {location && <span>{location}</span>}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>Applied {formatRelativeTime(applicant.created_at)}</p>
                      {applicant.proposed_rate != null && (
                        <p className="mt-0.5 font-medium text-foreground">
                          Proposed: {formatCurrency(applicant.proposed_rate)}/hr
                        </p>
                      )}
                      {applicant.available_start_date && (
                        <p className="mt-0.5">
                          Available: {formatDate(applicant.available_start_date)}
                        </p>
                      )}
                    </div>
                  </div>

                  {applicant.cover_letter && (
                    <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                      <p className="mb-1 text-xs font-medium text-foreground">
                        Cover Letter
                      </p>
                      <p className="line-clamp-3">{applicant.cover_letter}</p>
                    </div>
                  )}

                  <ApplicantActions
                    applicationId={applicant.id}
                    currentStatus={applicant.status}
                    jobId={id}
                  />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
