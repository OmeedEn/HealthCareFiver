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
      .eq('user_id', user.id)
      .single()

    profile = profileData
    role = (profileData?.role ?? user.user_metadata?.role ?? 'contractor') as string
    firstName =
      profileData?.first_name ?? user.user_metadata?.first_name ?? 'there'
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

      {role === 'contractor' && <ContractorDashboard profile={profile} isDemo={isDemoMode()} />}
      {role === 'facility' && <FacilityDashboard />}
      {role === 'admin' && <AdminDashboard />}
    </div>
  )
}

function ContractorDashboard({ profile, isDemo }: { profile: Record<string, unknown> | null; isDemo: boolean }) {
  const completionPct =
    typeof profile?.profile_completion_pct === 'number'
      ? profile.profile_completion_pct
      : 0

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
