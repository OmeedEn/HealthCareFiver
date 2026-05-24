import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatRelativeTime } from '@/lib/utils/format'
import {
  Users,
  Stethoscope,
  Building2,
  Briefcase,
  FileText,
  DollarSign,
  ShieldCheck,
} from 'lucide-react'
import Link from 'next/link'

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  // Fetch stats in parallel
  const [
    { count: totalUsers },
    { count: activeContractors },
    { count: activeFacilities },
    { count: openJobs },
    { count: activeContracts },
    { data: revenueData },
    { count: pendingCredentials },
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

  const stats = [
    {
      title: 'Total Users',
      value: totalUsers ?? 0,
      icon: <Users className="size-4 text-muted-foreground" />,
    },
    {
      title: 'Active Contractors',
      value: activeContractors ?? 0,
      icon: <Stethoscope className="size-4 text-muted-foreground" />,
    },
    {
      title: 'Active Facilities',
      value: activeFacilities ?? 0,
      icon: <Building2 className="size-4 text-muted-foreground" />,
    },
    {
      title: 'Open Jobs',
      value: openJobs ?? 0,
      icon: <Briefcase className="size-4 text-muted-foreground" />,
    },
    {
      title: 'Active Contracts',
      value: activeContracts ?? 0,
      icon: <FileText className="size-4 text-muted-foreground" />,
    },
    {
      title: 'Revenue',
      value: formatCurrency(totalRevenue),
      icon: <DollarSign className="size-4 text-muted-foreground" />,
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              {stat.icon}
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {(pendingCredentials ?? 0) > 0 && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-5 text-yellow-600" />
              <span className="text-sm font-medium">
                {pendingCredentials} credential{pendingCredentials === 1 ? '' : 's'} pending review
              </span>
            </div>
            <Link href="/admin/credentials">
              <Badge variant="outline">Review Now</Badge>
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentActivity />
        </CardContent>
      </Card>
    </div>
  )
}

async function RecentActivity() {
  const supabase = await createClient()

  const { data: recentUsers } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name, role, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  const activities = (recentUsers ?? []).map((u) => ({
    id: u.user_id,
    text: `${u.first_name ?? ''} ${u.last_name ?? ''} joined as ${u.role}`,
    time: u.created_at,
  }))

  if (activities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No recent activity.</p>
    )
  }

  return (
    <ul className="space-y-3">
      {activities.map((activity) => (
        <li key={activity.id} className="flex items-center justify-between text-sm">
          <span>{activity.text}</span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(activity.time)}
          </span>
        </li>
      ))}
    </ul>
  )
}
