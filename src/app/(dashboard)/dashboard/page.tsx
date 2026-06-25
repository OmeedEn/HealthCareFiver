import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Briefcase,
  ShieldCheck,
  FileText,
  CreditCard,
  PlusCircle,
  Users,
  ClipboardList,
  AlertCircle,
  MessageSquare,
  DollarSign,
  MapPin,
  Star,
  Building2,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import {
  isDemoMode,
  DEMO_CONTRACTOR,
  DEMO_FACILITY,
  DEMO_JOBS,
  DEMO_NOTIFICATIONS,
  DEMO_CONTRACTS,
  DEMO_PAYMENTS,
  DEMO_PROVIDERS,
} from '@/lib/demo/data'
import { CONTRACTOR_TYPE_LABELS, JOB_TYPE_LABELS } from '@/lib/utils/constants'
import { DemoRoleSwitcher } from '@/components/layout/demo-role-switcher'

type DashboardJob = {
  id: string
  title: string
  city: string | null
  state: string | null
  pay_rate_min: number | null
  pay_rate_max: number | null
  job_type: string | null
  shift_type: string | null
  urgency: string | null
  published_at: string | null
  facility_name: string | null
}

type DashboardNotification = {
  id: string
  type: string
  title: string
  body: string
  is_read: boolean
  created_at: string
}

type FacilityJobRow = {
  id: string
  title: string
  status: string
  city: string | null
  state: string | null
  total_applicants: number | null
  positions_available: number | null
  positions_filled: number | null
  published_at: string | null
}

type FacilityApplicantRow = {
  id: string
  first_name: string
  last_name: string
  credential: string | null
  city: string | null
  state: string | null
  hourly_rate_min: number | null
  hourly_rate_max: number | null
  average_rating: number | null
  job_title: string | null
}

type FacilityContractRow = {
  id: string
  title: string
  status: string
  contractor_name: string
  start_date: string | null
  end_date: string | null
  rate_amount: number | null
}

type FacilityKpis = {
  activeJobs: number
  totalApplicants: number
  activeContracts: number
  spendThisMonth: number
}

export default async function DashboardPage() {
  let role: 'contractor' | 'facility' | 'admin' = 'contractor'
  let firstName = 'there'
  let profile: Record<string, unknown> | null = null
  let jobs: DashboardJob[] = []
  let activity: DashboardNotification[] = []
  let specialties: string[] = []
  let contractorType: string | null = null

  // Facility-specific data
  let facilityKpis: FacilityKpis = {
    activeJobs: 0,
    totalApplicants: 0,
    activeContracts: 0,
    spendThisMonth: 0,
  }
  let facilityJobs: FacilityJobRow[] = []
  let facilityApplicants: FacilityApplicantRow[] = []
  let facilityContracts: FacilityContractRow[] = []

  if (isDemoMode()) {
    // Read the demo role override cookie set by DemoRoleSwitcher.
    const cookieStore = await cookies()
    const cookieRole = cookieStore.get('demo_role')?.value
    if (
      cookieRole === 'facility' ||
      cookieRole === 'admin' ||
      cookieRole === 'contractor'
    ) {
      role = cookieRole
    }

    if (role === 'facility') {
      firstName = DEMO_FACILITY.facility_name
      profile = {}
      const ownJobs = DEMO_JOBS.filter(
        (j) => j.facility_id === DEMO_FACILITY.id,
      )
      const sourceJobs = ownJobs.length > 0 ? ownJobs : DEMO_JOBS
      const ownContracts = DEMO_CONTRACTS.filter(
        (c) => c.facility_id === DEMO_FACILITY.id,
      )
      const contracts = ownContracts.length > 0 ? ownContracts : DEMO_CONTRACTS

      facilityKpis = {
        activeJobs: sourceJobs.filter((j) => j.status === 'open').length,
        totalApplicants: sourceJobs.reduce(
          (s, j) => s + (j.total_applicants ?? 0),
          0,
        ),
        activeContracts: contracts.filter((c) => c.status === 'active').length,
        spendThisMonth: DEMO_PAYMENTS.reduce(
          (s, p) => s + (Number(p.gross_amount) || 0),
          0,
        ),
      }

      facilityJobs = sourceJobs.slice(0, 4).map((j) => ({
        id: j.id,
        title: j.title,
        status: j.status,
        city: j.city,
        state: j.state,
        total_applicants: j.total_applicants,
        positions_available: j.positions_available,
        positions_filled: j.positions_filled,
        published_at: j.published_at,
      }))

      // Pair providers with jobs to fabricate a recent-applicants feed —
      // realistic enough for the demo without inventing whole job_applications
      // fixtures.
      facilityApplicants = DEMO_PROVIDERS.slice(0, 5).map((p, i) => ({
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        credential: p.credential ?? null,
        city: p.city ?? null,
        state: p.state ?? null,
        hourly_rate_min: p.hourly_rate_min ?? null,
        hourly_rate_max: p.hourly_rate_max ?? null,
        average_rating: p.average_rating ?? null,
        job_title: sourceJobs[i % sourceJobs.length]?.title ?? null,
      }))

      facilityContracts = contracts.slice(0, 3).map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        contractor_name:
          `${DEMO_CONTRACTOR.first_name} ${DEMO_CONTRACTOR.last_name}`.trim(),
        start_date: c.start_date,
        end_date: c.end_date,
        rate_amount: c.agreed_rate ?? null,
      }))

      activity = [...DEMO_NOTIFICATIONS]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 5)
        .map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          is_read: n.is_read,
          created_at: n.created_at,
        }))
    } else if (role === 'admin') {
      firstName = 'Admin'
      profile = {}
    } else {
      // contractor (default)
      firstName = DEMO_CONTRACTOR.first_name
      profile = {
        profile_completion_pct: 85,
      }
    }

    // Contractor-only demo data — only compute if we're in contractor view.
    if (role === 'contractor') {
      jobs = DEMO_JOBS.slice(0, 3).map((j) => ({
        id: j.id,
        title: j.title,
        city: j.city,
        state: j.state,
        pay_rate_min: j.pay_rate_min,
        pay_rate_max: j.pay_rate_max,
        job_type: j.job_type,
        shift_type: j.shift_type,
        urgency: j.urgency,
        published_at: j.published_at,
        facility_name: j.facility?.facility_name ?? null,
      }))
      activity = [...DEMO_NOTIFICATIONS]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 5)
        .map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          is_read: n.is_read,
          created_at: n.created_at,
        }))
      specialties = DEMO_CONTRACTOR.specialties ?? []
      contractorType = DEMO_CONTRACTOR.contractor_type ?? null
    }
  } else {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    profile = profileData
    role = (profileData?.role ?? user.user_metadata?.role ?? 'contractor') as
      | 'contractor'
      | 'facility'
      | 'admin'
    firstName =
      profileData?.first_name ?? user.user_metadata?.first_name ?? 'there'

    if (role === 'contractor') {
      const { data: jobsData } = await supabase
        .from('jobs')
        .select(
          'id, title, city, state, pay_rate_min, pay_rate_max, job_type, shift_type, urgency, published_at, facility_profiles(facility_name)'
        )
        .eq('status', 'open')
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(3)

      jobs = ((jobsData ?? []) as unknown as Array<{
        id: string
        title: string
        city: string | null
        state: string | null
        pay_rate_min: number | null
        pay_rate_max: number | null
        job_type: string | null
        shift_type: string | null
        urgency: string | null
        published_at: string | null
        facility_profiles:
          | { facility_name: string | null }
          | { facility_name: string | null }[]
          | null
      }>).map((j) => {
        const fp = Array.isArray(j.facility_profiles)
          ? j.facility_profiles[0]
          : j.facility_profiles
        return {
          id: j.id,
          title: j.title,
          city: j.city,
          state: j.state,
          pay_rate_min: j.pay_rate_min,
          pay_rate_max: j.pay_rate_max,
          job_type: j.job_type,
          shift_type: j.shift_type,
          urgency: j.urgency,
          published_at: j.published_at,
          facility_name: fp?.facility_name ?? null,
        }
      })

      const { data: notifData } = await supabase
        .from('notifications')
        .select('id, type, title, body, is_read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      activity = (notifData ?? []) as DashboardNotification[]

      const profileSpecialties = Array.isArray(
        (profileData as Record<string, unknown> | null)?.specialties
      )
        ? ((profileData as Record<string, unknown>).specialties as string[])
        : null

      if (profileSpecialties) {
        specialties = profileSpecialties
      } else {
        const { data: contractorProfile } = await supabase
          .from('contractor_profiles')
          .select('specialties, contractor_type')
          .eq('user_id', user.id)
          .single()
        specialties = Array.isArray(contractorProfile?.specialties)
          ? (contractorProfile?.specialties as string[])
          : []
        contractorType =
          (contractorProfile?.contractor_type as string | null) ?? null
      }

      if (!contractorType) {
        const ct = (profileData as Record<string, unknown> | null)
          ?.contractor_type
        if (typeof ct === 'string') contractorType = ct
      }
    }
  }

  return (
    <div className="space-y-6">
      {isDemoMode() && (
        <DemoRoleSwitcher current={role} />
      )}
      <div>
        <h1 className="text-2xl font-bold text-[#404145]">
          Welcome back, {firstName}!
        </h1>
        <p className="text-[#62646a]">
          Here&apos;s an overview of your {role === 'facility' ? 'facility' : role === 'admin' ? 'admin' : 'professional'} dashboard.
        </p>
      </div>

      {role === 'contractor' && (
        <ContractorDashboard
          profile={profile}
          isDemo={isDemoMode()}
          jobs={jobs}
          activity={activity}
          specialties={specialties}
          contractorType={contractorType}
        />
      )}
      {role === 'facility' && (
        <FacilityDashboard
          kpis={facilityKpis}
          jobs={facilityJobs}
          applicants={facilityApplicants}
          contracts={facilityContracts}
          activity={activity}
          isDemo={isDemoMode()}
        />
      )}
      {role === 'admin' && <AdminDashboard />}
    </div>
  )
}

function ContractorDashboard({
  profile,
  isDemo,
  jobs,
  activity,
  specialties,
  contractorType,
}: {
  profile: Record<string, unknown> | null
  isDemo: boolean
  jobs: DashboardJob[]
  activity: DashboardNotification[]
  specialties: string[]
  contractorType: string | null
}) {
  const completionPct =
    typeof profile?.profile_completion_pct === 'number'
      ? profile.profile_completion_pct
      : 0

  const contractorTypeLabel = contractorType
    ? CONTRACTOR_TYPE_LABELS[contractorType] ?? contractorType.toUpperCase()
    : null

  return (
    <div className="space-y-6">
      {completionPct < 100 && (
        <Card className="rounded-md border-[#bcebd5] bg-[#e8faf1]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0f8f56]">
              <AlertCircle className="h-5 w-5" />
              Complete Your Profile
            </CardTitle>
            <CardDescription className="font-semibold text-[#0f8f56]">
              Your profile is {completionPct}% complete. A complete profile helps you
              get matched with more jobs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/settings"
              className="text-sm font-black text-[#1dbf73] hover:underline"
            >
              Go to Profile Settings &rarr;
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Job Matches"
          value={isDemo ? '24' : '--'}
          description="New matches this week"
          icon={Briefcase}
        />
        <StatCard
          title="Credentials"
          value={isDemo ? '5' : '--'}
          description="Active credentials"
          icon={ShieldCheck}
        />
        <StatCard
          title="Active Contracts"
          value={isDemo ? '1' : '--'}
          description="Currently working"
          icon={FileText}
        />
        <StatCard
          title="Earnings"
          value={isDemo ? '$1,697.40' : '--'}
          description="This month"
          icon={CreditCard}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#404145]">
                Recommended for you
              </CardTitle>
              <CardAction>
                <Link
                  href="/contractor/jobs"
                  className="text-sm font-medium text-[#1dbf73] hover:underline"
                >
                  Browse all jobs &rarr;
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <p className="text-sm text-[#62646a]">
                  No open jobs right now. Check back soon.
                </p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-3">
                  {jobs.map((job) => (
                    <RecommendedJobCard key={job.id} job={job} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[#404145]">
                Recommended credentials
              </CardTitle>
              <CardAction>
                <Link
                  href="/contractor/credentials/upload"
                  className="text-sm font-medium text-[#1dbf73] hover:underline"
                >
                  Add credential &rarr;
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {SUGGESTED_CREDENTIALS.map((cred) => (
                  <div
                    key={cred.name}
                    className="flex items-center gap-3 rounded-md border border-[#e4e5e7] px-3 py-2.5"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#e8faf1]">
                      <ShieldCheck className="size-4 text-[#1dbf73]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#404145]">
                        {cred.name}
                      </p>
                      <p className="text-xs text-[#62646a]">
                        {cred.description}
                      </p>
                    </div>
                    <Link
                      href="/contractor/credentials/upload"
                      className="text-sm font-medium text-[#1dbf73] hover:underline"
                    >
                      Add &rarr;
                    </Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#404145]">Recent activity</CardTitle>
              <CardAction>
                <Link
                  href="/notifications"
                  className="text-sm font-medium text-[#1dbf73] hover:underline"
                >
                  View all &rarr;
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <p className="text-sm text-[#62646a]">
                  No recent activity yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {activity.map((item) => {
                    const Icon = getNotificationIcon(item.type)
                    return (
                      <li key={item.id} className="flex items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#e8faf1]">
                          <Icon className="size-4 text-[#1dbf73]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[#404145]">
                            {item.title}
                          </p>
                          <p className="line-clamp-1 text-sm text-[#62646a]">
                            {item.body}
                          </p>
                          <p className="text-xs text-[#6b7280]">
                            {formatRelativeTime(item.created_at)}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[#404145]">Your interests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {contractorTypeLabel && (
                <div>
                  <p className="mb-2 text-xs font-medium text-[#6b7280]">
                    Professional role
                  </p>
                  <Badge className="bg-[#e8faf1] px-3 py-1 text-sm text-[#0f8f56]">
                    {contractorTypeLabel}
                  </Badge>
                </div>
              )}
              <div>
                <p className="mb-2 text-xs font-medium text-[#6b7280]">
                  Specialties
                </p>
                {specialties.length === 0 ? (
                  <Link
                    href="/contractor/profile/edit"
                    className="text-sm font-medium text-[#1dbf73] hover:underline"
                  >
                    Add specialties &rarr;
                  </Link>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {specialties.map((s) => (
                      <Badge key={s} variant="outline" className="text-[#404145]">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

const SUGGESTED_CREDENTIALS: { name: string; description: string }[] = [
  {
    name: 'ACLS Certification',
    description: 'Required for many acute care and ICU contracts.',
  },
  {
    name: 'PALS Certification',
    description: 'Expands eligibility for pediatric assignments.',
  },
  {
    name: 'Background Check',
    description: 'Speeds up onboarding with new facilities.',
  },
]

function getNotificationIcon(type: string) {
  switch (type) {
    case 'new_message':
      return MessageSquare
    case 'job_match':
      return Briefcase
    case 'timesheet_approved':
    case 'timesheet_submitted':
      return FileText
    case 'payment_received':
    case 'payment_released':
      return DollarSign
    case 'credential_expiring':
    case 'credential_rejected':
      return AlertCircle
    default:
      return AlertCircle
  }
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffMs = Date.now() - then
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diffMs < minute) return 'Just now'
  if (diffMs < hour) {
    const m = Math.floor(diffMs / minute)
    return `${m} min${m === 1 ? '' : 's'} ago`
  }
  if (diffMs < day) {
    const h = Math.floor(diffMs / hour)
    return `${h} hour${h === 1 ? '' : 's'} ago`
  }
  if (diffMs < 7 * day) {
    const d = Math.floor(diffMs / day)
    return `${d} day${d === 1 ? '' : 's'} ago`
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function RecommendedJobCard({ job }: { job: DashboardJob }) {
  const location = [job.city, job.state].filter(Boolean).join(', ')
  const payRange =
    job.pay_rate_min != null && job.pay_rate_max != null
      ? `$${job.pay_rate_min}–$${job.pay_rate_max}/hr`
      : job.pay_rate_min != null
        ? `From $${job.pay_rate_min}/hr`
        : null
  const jobTypeLabel = job.job_type
    ? JOB_TYPE_LABELS[job.job_type] ?? job.job_type
    : null

  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border border-[#e4e5e7] p-4">
      <div className="space-y-1">
        <p className="line-clamp-2 font-semibold text-[#404145]">{job.title}</p>
        <p className="text-sm text-[#62646a]">
          {job.facility_name ? job.facility_name : 'Healthcare facility'}
          {location ? ` • ${location}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {payRange && (
          <span className="text-sm font-medium text-[#0f8f56]">
            {payRange}
          </span>
        )}
        {jobTypeLabel && (
          <Badge variant="outline" className="text-[#404145]">
            {jobTypeLabel}
          </Badge>
        )}
      </div>
      {location && (
        <div className="flex items-center gap-1 text-xs text-[#6b7280]">
          <MapPin className="size-3" />
          <span>{location}</span>
        </div>
      )}
      <div className="mt-auto pt-1">
        <Link
          href={`/contractor/jobs/${job.id}`}
          className="text-sm font-medium text-[#1dbf73] hover:underline"
        >
          View &rarr;
        </Link>
      </div>
    </div>
  )
}

function FacilityDashboard({
  kpis,
  jobs,
  applicants,
  contracts,
  activity,
  isDemo,
}: {
  kpis: FacilityKpis
  jobs: FacilityJobRow[]
  applicants: FacilityApplicantRow[]
  contracts: FacilityContractRow[]
  activity: DashboardNotification[]
  isDemo: boolean
}) {
  const moneyFmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
  const noJobsYet = jobs.length === 0

  return (
    <div className="space-y-6">
      {noJobsYet && (
        <Card className="rounded-md border-[#bcebd5] bg-[#e8faf1]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0f8f56]">
              <PlusCircle className="h-5 w-5" />
              Post your first job
            </CardTitle>
            <CardDescription className="font-semibold text-[#0f8f56]">
              Start finding qualified healthcare professionals for your
              facility.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/facility/jobs/new"
              className="text-sm font-semibold text-[#1dbf73] hover:underline"
            >
              Post a job &rarr;
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active jobs"
          value={isDemo ? String(kpis.activeJobs) : '--'}
          description="Currently posted"
          icon={Briefcase}
        />
        <StatCard
          title="Total applicants"
          value={isDemo ? String(kpis.totalApplicants) : '--'}
          description="Across all open jobs"
          icon={ClipboardList}
        />
        <StatCard
          title="Active contracts"
          value={isDemo ? String(kpis.activeContracts) : '--'}
          description="Currently in progress"
          icon={FileText}
        />
        <StatCard
          title="Spend"
          value={isDemo ? moneyFmt.format(kpis.spendThisMonth) : '--'}
          description="This month"
          icon={CreditCard}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Your open jobs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-[#404145]">Your open jobs</CardTitle>
              <CardAction>
                <Link
                  href="/facility/jobs"
                  className="text-sm font-medium text-[#1dbf73] hover:underline"
                >
                  Manage all &rarr;
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <p className="text-sm text-[#62646a]">
                  No jobs posted yet.{' '}
                  <Link
                    href="/facility/jobs/new"
                    className="font-medium text-[#1dbf73] hover:underline"
                  >
                    Post your first job
                  </Link>
                  .
                </p>
              ) : (
                <ul className="divide-y divide-[#f1f3f5]">
                  {jobs.map((job) => {
                    const location = [job.city, job.state]
                      .filter(Boolean)
                      .join(', ')
                    return (
                      <li key={job.id} className="py-3 first:pt-0 last:pb-0">
                        <Link
                          href={`/facility/jobs/${job.id}`}
                          className="group flex items-start justify-between gap-4"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-[#404145] group-hover:text-[#0f8f56]">
                              {job.title}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#62646a]">
                              {location && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="size-3" />
                                  {location}
                                </span>
                              )}
                              {job.positions_available != null && (
                                <span>
                                  {job.positions_filled ?? 0}/
                                  {job.positions_available} filled
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <Badge className="bg-[#e8faf1] text-[#0f8f56] hover:bg-[#e8faf1]">
                              {job.total_applicants ?? 0} applicants
                            </Badge>
                            <span className="text-xs text-[#6b7280]">
                              {job.status.replace('_', ' ')}
                            </span>
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Recent applicants */}
          <Card>
            <CardHeader>
              <CardTitle className="text-[#404145]">
                Recent applicants
              </CardTitle>
              <CardAction>
                <Link
                  href="/facility/contractors"
                  className="text-sm font-medium text-[#1dbf73] hover:underline"
                >
                  Browse contractors &rarr;
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent>
              {applicants.length === 0 ? (
                <p className="text-sm text-[#62646a]">
                  Applicants will appear here once your jobs receive
                  applications.
                </p>
              ) : (
                <ul className="space-y-3">
                  {applicants.map((a) => {
                    const initials = `${a.first_name?.[0] ?? ''}${
                      a.last_name?.[0] ?? ''
                    }`
                      .toUpperCase()
                      .slice(0, 2)
                    const location = [a.city, a.state]
                      .filter(Boolean)
                      .join(', ')
                    const payRange =
                      a.hourly_rate_min != null && a.hourly_rate_max != null
                        ? `$${a.hourly_rate_min}–$${a.hourly_rate_max}/hr`
                        : null
                    return (
                      <li key={a.id}>
                        <Link
                          href={`/facility/contractors/${a.id}`}
                          className="flex items-start gap-3 rounded-lg p-2 -mx-2 hover:bg-[#f9fafb]"
                        >
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#e8faf1] text-sm font-semibold text-[#0f8f56]">
                            {initials || '?'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <p className="truncate text-sm font-semibold text-[#404145]">
                                {a.first_name} {a.last_name}
                              </p>
                              {a.credential && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-medium text-[#404145]"
                                >
                                  {a.credential}
                                </Badge>
                              )}
                            </div>
                            <p className="line-clamp-1 text-xs text-[#62646a]">
                              {a.job_title && `Applied to ${a.job_title}`}
                              {a.job_title && location && ' · '}
                              {location}
                            </p>
                            <div className="mt-1 flex items-center gap-2 text-xs">
                              {a.average_rating != null && (
                                <span className="inline-flex items-center gap-1 text-[#404145]">
                                  <Star className="size-3 fill-[#fbbf24] text-[#fbbf24]" />
                                  {a.average_rating.toFixed(1)}
                                </span>
                              )}
                              {payRange && (
                                <span className="text-[#0f8f56]">
                                  {payRange}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Active contracts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-[#404145]">
                Active contracts
              </CardTitle>
              <CardAction>
                <Link
                  href="/facility/contracts"
                  className="text-sm font-medium text-[#1dbf73] hover:underline"
                >
                  View all &rarr;
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent>
              {contracts.length === 0 ? (
                <p className="text-sm text-[#62646a]">
                  No active contracts.
                </p>
              ) : (
                <ul className="space-y-3">
                  {contracts.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/facility/contracts/${c.id}`}
                        className="block rounded-md p-2 -mx-2 hover:bg-[#f9fafb]"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="size-4 shrink-0 text-[#1dbf73]" />
                          <p className="line-clamp-1 text-sm font-medium text-[#404145]">
                            {c.title}
                          </p>
                        </div>
                        <p className="mt-1 ml-6 line-clamp-1 text-xs text-[#62646a]">
                          {c.contractor_name}
                          {c.rate_amount != null && ` · $${c.rate_amount}/hr`}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-[#404145]">
                Recent activity
              </CardTitle>
              <CardAction>
                <Link
                  href="/notifications"
                  className="text-sm font-medium text-[#1dbf73] hover:underline"
                >
                  View all &rarr;
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <p className="text-sm text-[#62646a]">
                  No recent activity yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {activity.map((item) => {
                    const Icon = getNotificationIcon(item.type)
                    return (
                      <li key={item.id} className="flex items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#e8faf1]">
                          <Icon className="size-4 text-[#1dbf73]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[#404145]">
                            {item.title}
                          </p>
                          <p className="line-clamp-1 text-sm text-[#62646a]">
                            {item.body}
                          </p>
                          <p className="text-xs text-[#6b7280]">
                            {formatRelativeTime(item.created_at)}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#404145]">
                <TrendingUp className="size-4 text-[#1dbf73]" />
                Boost your hires
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-[#62646a]">
                {[
                  'Detailed job descriptions get 3× more qualified applicants.',
                  'List required credentials upfront to save review time.',
                  'Respond to applicants within 24 hours.',
                ].map((tip) => (
                  <li key={tip} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#1dbf73]" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function AdminDashboard() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Users"
        value="--"
        description="Registered users"
        icon={Users}
      />
      <StatCard
        title="Active Jobs"
        value="--"
        description="Currently posted"
        icon={Briefcase}
      />
      <StatCard
        title="Pending Credentials"
        value="--"
        description="Awaiting review"
        icon={ShieldCheck}
      />
      <StatCard
        title="Revenue"
        value="--"
        description="This month"
        icon={CreditCard}
      />
    </div>
  )
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: string
  description: string
  icon: React.ElementType
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-[#62646a]">
          {title}
        </CardTitle>
        <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#1dbf73]/10 to-[#1dbf73]/20">
          <Icon className="size-4 text-[#1dbf73]" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-[#404145]">{value}</div>
        <p className="mt-1 text-xs text-[#62646a]">{description}</p>
      </CardContent>
    </Card>
  )
}
