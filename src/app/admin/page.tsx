import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatRelativeTime } from '@/lib/utils/format'
import {
  isDemoMode,
  DEMO_JOBS,
  DEMO_CONTRACTS,
  DEMO_PAYMENTS,
  DEMO_CREDENTIALS,
  DEMO_CONTRACTOR,
  DEMO_FACILITY,
  DEMO_PROVIDERS,
} from '@/lib/demo/data'
import {
  Users,
  Stethoscope,
  Building2,
  Briefcase,
  FileText,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

type Stat = {
  title: string
  value: string | number
  description: string
  icon: LucideIcon
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: Stat) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-[#62646a]">{title}</CardTitle>
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

type Activity = {
  id: string
  text: string
  time: string
}

export default async function AdminDashboardPage() {
  let stats: Stat[]
  let pendingCredentials: number
  let openDisputes: number
  let activities: Activity[]

  if (isDemoMode()) {
    const totalUsers = DEMO_PROVIDERS.length + 5 // providers + a few facilities
    const activeContractors = DEMO_PROVIDERS.filter((p) => p.is_available).length
    const activeFacilities = 5
    const openJobs = DEMO_JOBS.filter((j) => j.status === 'open').length
    const activeContracts = DEMO_CONTRACTS.filter(
      (c) => c.status === 'active'
    ).length
    const totalRevenue = DEMO_PAYMENTS.filter(
      (p) => p.status === 'released'
    ).reduce((sum, p) => sum + (p.platform_fee ?? 0), 0)
    pendingCredentials = DEMO_CREDENTIALS.filter(
      (c) => c.status === 'pending_review'
    ).length
    openDisputes = 2

    stats = [
      {
        title: 'Total Users',
        value: totalUsers,
        description: 'Across contractors and facilities',
        icon: Users,
      },
      {
        title: 'Active Contractors',
        value: activeContractors,
        description: 'Available for assignments now',
        icon: Stethoscope,
      },
      {
        title: 'Active Facilities',
        value: activeFacilities,
        description: 'Verified hospitals and clinics',
        icon: Building2,
      },
      {
        title: 'Open Jobs',
        value: openJobs,
        description: 'Accepting applications',
        icon: Briefcase,
      },
      {
        title: 'Active Contracts',
        value: activeContracts,
        description: 'Currently in progress',
        icon: FileText,
      },
      {
        title: 'Revenue',
        value: formatCurrency(totalRevenue),
        description: 'Lifetime platform fees',
        icon: DollarSign,
      },
    ]

    const now = new Date()
    activities = [
      {
        id: 'demo-act-1',
        text: `${DEMO_CONTRACTOR.first_name} ${DEMO_CONTRACTOR.last_name} joined as ${DEMO_CONTRACTOR.role}`,
        time: new Date(now.getTime() - 1000 * 60 * 45).toISOString(),
      },
      {
        id: 'demo-act-2',
        text: `${DEMO_FACILITY.facility_name} joined as facility`,
        time: new Date(now.getTime() - 1000 * 60 * 60 * 3).toISOString(),
      },
      ...DEMO_PROVIDERS.slice(0, 6).map((p, i) => ({
        id: `demo-act-${i + 3}`,
        text: `${p.first_name} ${p.last_name} joined as ${p.contractor_type}`,
        time: new Date(
          now.getTime() - 1000 * 60 * 60 * (6 + i * 4)
        ).toISOString(),
      })),
    ]
  } else {
    const supabase = await createClient()

    // Fetch stats in parallel
    const [
      { count: totalUsers },
      { count: activeContractors },
      { count: activeFacilities },
      { count: openJobs },
      { count: activeContracts },
      { data: revenueData },
      { count: pendingCount },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'contractor'),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'facility'),
      supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open'),
      supabase
        .from('contracts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase
        .from('payments')
        .select('platform_fee')
        .eq('status', 'released'),
      supabase
        .from('credentials')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending_review'),
    ])

    const totalRevenue = (revenueData ?? []).reduce(
      (sum: number, p: { platform_fee: number }) => sum + (p.platform_fee ?? 0),
      0
    )

    pendingCredentials = pendingCount ?? 0
    openDisputes = 0

    stats = [
      {
        title: 'Total Users',
        value: totalUsers ?? 0,
        description: 'Across contractors and facilities',
        icon: Users,
      },
      {
        title: 'Active Contractors',
        value: activeContractors ?? 0,
        description: 'Available for assignments now',
        icon: Stethoscope,
      },
      {
        title: 'Active Facilities',
        value: activeFacilities ?? 0,
        description: 'Verified hospitals and clinics',
        icon: Building2,
      },
      {
        title: 'Open Jobs',
        value: openJobs ?? 0,
        description: 'Accepting applications',
        icon: Briefcase,
      },
      {
        title: 'Active Contracts',
        value: activeContracts ?? 0,
        description: 'Currently in progress',
        icon: FileText,
      },
      {
        title: 'Revenue',
        value: formatCurrency(totalRevenue),
        description: 'Lifetime platform fees',
        icon: DollarSign,
      },
    ]

    const { data: recentUsers } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, role, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    activities = (recentUsers ?? []).map(
      (u: {
        user_id: string
        first_name: string | null
        last_name: string | null
        role: string
        created_at: string
      }) => ({
        id: u.user_id,
        text: `${u.first_name ?? ''} ${u.last_name ?? ''} joined as ${u.role}`,
        time: u.created_at,
      })
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#404145]">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-[#62646a]">
          Platform health at a glance — users, jobs, contracts, and revenue.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.slice(0, 4).map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            description={stat.description}
            icon={stat.icon}
          />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.slice(4).map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            description={stat.description}
            icon={stat.icon}
          />
        ))}
        <StatCard
          title="Pending Credentials"
          value={pendingCredentials}
          description="Awaiting admin review"
          icon={ShieldCheck}
        />
        <StatCard
          title="Open Disputes"
          value={openDisputes}
          description="Require resolution"
          icon={AlertTriangle}
        />
      </div>

      {pendingCredentials > 0 && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#1dbf73]/10 to-[#1dbf73]/20">
                <ShieldCheck className="size-4 text-[#1dbf73]" />
              </div>
              <span className="text-sm font-medium text-[#404145]">
                {pendingCredentials} credential
                {pendingCredentials === 1 ? '' : 's'} pending review
              </span>
            </div>
            <Link href="/admin/credentials">
              <Badge
                variant="outline"
                className="border-[#1dbf73] bg-[#e8faf1] text-[#0f8f56]"
              >
                Review Now
              </Badge>
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-[#404145]">
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-[#6b7280]">No recent activity.</p>
          ) : (
            <ul className="space-y-3">
              {activities.map((activity) => (
                <li
                  key={activity.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-[#404145]">{activity.text}</span>
                  <span className="text-xs text-[#6b7280]">
                    {formatRelativeTime(activity.time)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
