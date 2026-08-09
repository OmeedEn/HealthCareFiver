import { redirect } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Briefcase,
  ShieldCheck,
  FileText,
  CreditCard,
  PlusCircle,
  Users,
  ClipboardList,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'
import { isDemoMode, DEMO_CONTRACTOR } from '@/lib/demo/data'

export default async function DashboardPage() {
  let role = 'contractor'
  let firstName = 'there'
  let profile: Record<string, unknown> | null = null
  let verificationStatus: string | null = null
  let verificationNotes: string | null = null

  if (isDemoMode()) {
    firstName = DEMO_CONTRACTOR.first_name
    role = 'contractor'
    profile = {
      profile_completion_pct: 85,
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
      .eq('id', user.id)
      .single()

    profile = profileData
    role = (profileData?.role ?? user.user_metadata?.role ?? 'contractor') as string
    firstName =
      profileData?.first_name ?? user.user_metadata?.first_name ?? 'there'

    if (role === 'contractor') {
      const { data: contractorProfile } = await supabase
        .from('contractor_profiles')
        .select('profile_completion_pct, verification_status, verification_notes')
        .eq('id', user.id)
        .maybeSingle()

      if (contractorProfile) {
        profile = { ...profile, ...contractorProfile }
      }
      verificationStatus = contractorProfile?.verification_status ?? null
      verificationNotes = contractorProfile?.verification_notes ?? null
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
          verificationStatus={verificationStatus}
          verificationNotes={verificationNotes}
        />
      )}
      {role === 'facility' && <FacilityDashboard />}
      {role === 'admin' && <AdminDashboard />}
    </div>
  )
}

const VERIFICATION_BANNER: Record<
  string,
  { title: string; className: string; iconClassName: string }
> = {
  pending_review: {
    title: 'Your account is pending verification',
    className: 'border-[#f5deb3] bg-[#fdf6e3]',
    iconClassName: 'text-[#b8860b]',
  },
  more_info_requested: {
    title: 'Action needed: more information requested',
    className: 'border-[#f5c6cb] bg-[#fdecea]',
    iconClassName: 'text-[#c0392b]',
  },
  rejected: {
    title: 'Your verification was not approved',
    className: 'border-[#f5c6cb] bg-[#fdecea]',
    iconClassName: 'text-[#c0392b]',
  },
}

function VerificationBanner({
  status,
  notes,
}: {
  status: string | null
  notes: string | null
}) {
  if (!status || status === 'approved') return null

  const config = VERIFICATION_BANNER[status]
  if (!config) return null

  return (
    <Card className={`rounded-md ${config.className}`}>
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 ${config.iconClassName}`}>
          <AlertCircle className="h-5 w-5" />
          {config.title}
        </CardTitle>
        {notes && (
          <CardDescription className="font-medium text-[#404145]">
            {notes}
          </CardDescription>
        )}
        {status === 'pending_review' && !notes && (
          <CardDescription>
            An admin is reviewing your submitted documents. You&apos;ll be notified once
            you&apos;re approved to go live and apply to jobs.
          </CardDescription>
        )}
      </CardHeader>
      {status === 'more_info_requested' && (
        <CardContent>
          <Link
            href="/contractor/credentials/upload"
            className="text-sm font-black text-[#1dbf73] hover:underline"
          >
            Upload Requested Document &rarr;
          </Link>
        </CardContent>
      )}
    </Card>
  )
}

function ContractorDashboard({
  profile,
  isDemo,
  verificationStatus,
  verificationNotes,
}: {
  profile: Record<string, unknown> | null
  isDemo: boolean
  verificationStatus: string | null
  verificationNotes: string | null
}) {
  const completionPct =
    typeof profile?.profile_completion_pct === 'number'
      ? profile.profile_completion_pct
      : 0

  return (
    <div className="space-y-6">
      <VerificationBanner status={verificationStatus} notes={verificationNotes} />
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
              href="/dashboard/settings"
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
            href="/dashboard/post-job"
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
