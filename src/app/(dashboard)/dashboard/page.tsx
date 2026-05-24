import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const role = (profile?.role ?? user.user_metadata?.role ?? 'contractor') as string
  const firstName =
    profile?.first_name ?? user.user_metadata?.first_name ?? 'there'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {firstName}!
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s an overview of your {role === 'facility' ? 'facility' : 'professional'} dashboard.
        </p>
      </div>

      {role === 'contractor' && <ContractorDashboard profile={profile} />}
      {role === 'facility' && <FacilityDashboard />}
      {role === 'admin' && <AdminDashboard />}
    </div>
  )
}

function ContractorDashboard({ profile }: { profile: Record<string, unknown> | null }) {
  const completionPct =
    typeof profile?.profile_completion_pct === 'number'
      ? profile.profile_completion_pct
      : 0

  return (
    <div className="space-y-6">
      {completionPct < 100 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <AlertCircle className="h-5 w-5" />
              Complete Your Profile
            </CardTitle>
            <CardDescription className="text-blue-600">
              Your profile is {completionPct}% complete. A complete profile helps you
              get matched with more jobs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard/settings"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Go to Profile Settings &rarr;
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Job Matches"
          value="--"
          description="New matches this week"
          icon={Briefcase}
        />
        <StatCard
          title="Credentials"
          value="--"
          description="Active credentials"
          icon={ShieldCheck}
        />
        <StatCard
          title="Active Contracts"
          value="--"
          description="Currently working"
          icon={FileText}
        />
        <StatCard
          title="Earnings"
          value="--"
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
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700">
            <PlusCircle className="h-5 w-5" />
            Post Your First Job
          </CardTitle>
          <CardDescription className="text-blue-600">
            Start finding qualified healthcare professionals for your facility.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/dashboard/post-job"
            className="text-sm font-medium text-blue-600 hover:underline"
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}
