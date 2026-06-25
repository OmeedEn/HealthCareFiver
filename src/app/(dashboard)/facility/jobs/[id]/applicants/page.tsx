import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils/format'
import { CONTRACTOR_TYPE_LABELS } from '@/lib/utils/constants'
import { ArrowLeft, Star, Users } from 'lucide-react'
import { isDemoMode, DEMO_JOBS, DEMO_PROVIDERS } from '@/lib/demo/data'
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
  applied: 'secondary',
  shortlisted: 'secondary',
  interviewing: 'outline',
  offered: 'default',
  accepted: 'default',
  rejected: 'destructive',
  withdrawn: 'destructive',
}

// Brand-green pill override for shortlisted; accepted/offered also use brand green.
function statusBadgeClass(status: string): string | undefined {
  if (status === 'shortlisted') {
    return 'border-transparent bg-[#e8faf1] text-[#0f8f56] hover:bg-[#e8faf1]'
  }
  if (status === 'accepted' || status === 'offered') {
    return 'border-transparent bg-[#1dbf73] text-white hover:bg-[#19a463]'
  }
  return undefined
}

export default async function ApplicantsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // ---------------- Demo mode ----------------
  if (isDemoMode()) {
    const job = DEMO_JOBS.find((j) => j.id === id)
    if (!job) {
      notFound()
    }

    const demoApplicants: Applicant[] = DEMO_PROVIDERS.slice(0, 6).map(
      (p, i) => ({
        id: `app-${i + 1}`,
        status: (['applied', 'shortlisted', 'interviewing', 'applied', 'rejected', 'applied'] as const)[i] ?? 'applied',
        cover_letter:
          i % 2 === 0
            ? `I'm very interested in the ${job.title} role. With ${p.years_of_experience} years of experience in ${p.specialty}, I'm confident I can contribute to your team.`
            : null,
        proposed_rate: p.hourly_rate_max,
        available_start_date: `2026-07-0${(i % 7) + 1}`,
        created_at: `2026-05-2${i}T10:00:00Z`,
        contractor_profiles: {
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          contractor_type: p.contractor_type,
          years_experience: p.years_of_experience,
          average_rating: p.average_rating,
          city: p.city,
          state: p.state,
        },
      })
    )

    return (
      <ApplicantsView
        jobId={id}
        jobTitle={job.title}
        applicants={demoApplicants}
      />
    )
  }

  // ---------------- Real (Supabase) mode ----------------
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
    <ApplicantsView
      jobId={id}
      jobTitle={job.title}
      applicants={typedApplicants}
    />
  )
}

// Inline render helper (kept in this file per "no extracted components" rule —
// it lives in the same module and is only consumed by the default export).
function ApplicantsView({
  jobId,
  jobTitle,
  applicants,
}: {
  jobId: string
  jobTitle: string
  applicants: Applicant[]
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-6 font-sans">
      <Link
        href={`/facility/jobs/${jobId}`}
        className="inline-flex items-center gap-1.5 text-sm text-[#62646a] hover:text-[#404145]"
      >
        <ArrowLeft className="size-4" />
        Back to job
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-[#404145]">
          Applicants for {jobTitle}
        </h1>
        <p className="text-[#62646a]">
          {applicants.length} applicant
          {applicants.length !== 1 ? 's' : ''} so far
        </p>
      </div>

      {applicants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-[#e8faf1]">
              <Users className="size-6 text-[#1dbf73]" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-[#404145]">
                No applicants yet
              </p>
              <p className="text-sm text-[#6b7280]">
                As contractors apply to this job, you&apos;ll see them here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {applicants.map((applicant) => {
            const profile = applicant.contractor_profiles
            const name = profile
              ? [profile.first_name, profile.last_name]
                  .filter(Boolean)
                  .join(' ') || 'Unknown'
              : 'Unknown'
            const location = profile
              ? [profile.city, profile.state].filter(Boolean).join(', ')
              : null
            const badgeClass = statusBadgeClass(applicant.status)

            return (
              <Card key={applicant.id}>
                <CardContent className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {profile ? (
                          <Link
                            href={`/facility/contractors/${profile.id}`}
                            className="font-medium text-[#404145] hover:text-[#1dbf73] hover:underline"
                          >
                            {name}
                          </Link>
                        ) : (
                          <span className="font-medium text-[#404145]">
                            {name}
                          </span>
                        )}
                        <Badge
                          variant={
                            STATUS_VARIANT[applicant.status] ?? 'outline'
                          }
                          className={badgeClass}
                        >
                          {STATUS_LABELS[applicant.status] ?? applicant.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6b7280]">
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
                            <Star className="size-4 fill-[#fbbf24] text-[#fbbf24]" />
                            {profile.average_rating.toFixed(1)}
                          </span>
                        )}
                        {location && <span>{location}</span>}
                      </div>
                    </div>
                    <div className="text-right text-xs text-[#6b7280]">
                      <p>Applied {formatRelativeTime(applicant.created_at)}</p>
                      {applicant.proposed_rate != null && (
                        <p className="mt-0.5 font-medium text-[#404145]">
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
                    <div className="rounded-md bg-[#e8faf1]/60 p-3 text-sm text-[#62646a]">
                      <p className="mb-1 text-xs font-medium text-[#0f8f56]">
                        Cover Letter
                      </p>
                      <p className="line-clamp-3">{applicant.cover_letter}</p>
                    </div>
                  )}

                  <ApplicantActions
                    applicationId={applicant.id}
                    currentStatus={applicant.status}
                    jobId={jobId}
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
