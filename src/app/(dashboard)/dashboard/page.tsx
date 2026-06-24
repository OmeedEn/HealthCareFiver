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
} from 'lucide-react'
import Link from 'next/link'
import {
  isDemoMode,
  DEMO_CONTRACTOR,
  DEMO_JOBS,
  DEMO_NOTIFICATIONS,
} from '@/lib/demo/data'
import { CONTRACTOR_TYPE_LABELS, JOB_TYPE_LABELS } from '@/lib/utils/constants'

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

export default async function DashboardPage() {
  let role = 'contractor'
  let firstName = 'there'
  let profile: Record<string, unknown> | null = null
  let jobs: DashboardJob[] = []
  let activity: DashboardNotification[] = []
  let specialties: string[] = []
  let contractorType: string | null = null

  if (isDemoMode()) {
    firstName = DEMO_CONTRACTOR.first_name
    role = 'contractor'
    profile = {
      profile_completion_pct: 85,
    }
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
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
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
    role = (profileData?.role ?? user.user_metadata?.role ?? 'contractor') as string
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
      <div>
        <h1 className="text-2xl font-bold text-[#404145]">
          Welcome back, {firstName}!
        </h1>
        <p className="text-[#62646a]">
          Here&apos;s an overview of your {role === 'facility' ? 'facility' : 'professional'} dashboard.
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
      {role === 'facility' && <FacilityDashboard />}
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

function FacilityDashboard() {
  return (
    <div className="space-y-6">
      <Card className="rounded-md border-[#bcebd5] bg-[#e8faf1]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#0f8f56]">
            <PlusCircle className="h-5 w-5" />
            Post Your First Job
          </CardTitle>
          <CardDescription className="font-semibold text-[#0f8f56]">
            Start finding qualified healthcare professionals for your facility.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/facility/jobs/new"
            className="text-sm font-black text-[#1dbf73] hover:underline"
          >
            Post a Job &rarr;
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Jobs"
          value="--"
          description="Currently posted"
          icon={Briefcase}
        />
        <StatCard
          title="Applications"
          value="--"
          description="Pending review"
          icon={ClipboardList}
        />
        <StatCard
          title="Active Contracts"
          value="--"
          description="Currently working"
          icon={FileText}
        />
        <StatCard
          title="Spend"
          value="--"
          description="This month"
          icon={CreditCard}
        />
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
