import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContractsTabs } from './contracts-tabs'
import { isDemoMode, DEMO_CONTRACTS } from '@/lib/demo/data'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import {
  BriefcaseIcon,
  CheckCircle2Icon,
  ClockIcon,
  FileTextIcon,
  SearchIcon,
} from 'lucide-react'

interface ContractRow {
  id: string
  title: string
  status: string
  rate_amount: number | null
  rate_type: string | null
  start_date: string | null
  end_date: string | null
  created_at: string
  facility_profiles: {
    facility_name: string
  } | null
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  completed: 'Completed',
  pending_contractor: 'Pending You',
  pending_facility: 'Pending Facility',
  draft: 'Draft',
  cancelled: 'Cancelled',
  terminated: 'Terminated',
  disputed: 'Disputed',
}

function isActiveStatus(status: string) {
  return (
    status === 'active' ||
    status === 'pending_contractor' ||
    status === 'pending_facility'
  )
}

export default async function ContractorContractsPage() {
  let allContracts: ContractRow[] = []

  if (isDemoMode()) {
    allContracts = DEMO_CONTRACTS.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      rate_amount: c.agreed_rate,
      rate_type: c.rate_type,
      start_date: c.start_date,
      end_date: c.end_date ?? null,
      created_at: c.created_at,
      facility_profiles: c.facility
        ? { facility_name: c.facility.facility_name }
        : null,
    }))
  } else {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: contracts } = await supabase
      .from('contracts')
      .select(
        'id, title, status, rate_amount, rate_type, start_date, end_date, created_at, facility_profiles!inner(facility_name)'
      )
      .eq('contractor_id', user.id)
      .order('created_at', { ascending: false })

    allContracts = (contracts ?? []) as unknown as ContractRow[]
  }

  const activeContracts = allContracts.filter((c) => isActiveStatus(c.status))
  const completedContracts = allContracts.filter(
    (c) => c.status === 'completed'
  )

  const tabCounts = {
    all: allContracts.length,
    active: activeContracts.length,
    completed: completedContracts.length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#404145]">My Contracts</h1>
        <p className="text-[#62646a]">
          View and manage your contracts with facilities
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Active"
          value={tabCounts.active.toString()}
          description="In-progress engagements"
          icon={ClockIcon}
        />
        <StatCard
          title="Completed"
          value={tabCounts.completed.toString()}
          description="Successfully wrapped up"
          icon={CheckCircle2Icon}
        />
        <StatCard
          title="Total"
          value={tabCounts.all.toString()}
          description="All-time contracts"
          icon={BriefcaseIcon}
        />
      </div>

      <ContractsTabs
        tabCounts={tabCounts}
        activeContent={<ContractList contracts={activeContracts} kind="active" />}
        completedContent={
          <ContractList contracts={completedContracts} kind="completed" />
        }
        allContent={<ContractList contracts={allContracts} kind="all" />}
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

function ContractList({
  contracts,
  kind,
}: {
  contracts: ContractRow[]
  kind: 'active' | 'completed' | 'all'
}) {
  if (contracts.length === 0) {
    return <EmptyState kind={kind} />
  }

  return (
    <div className="space-y-3">
      {contracts.map((contract) => (
        <ContractRowCard key={contract.id} contract={contract} />
      ))}
    </div>
  )
}

function ContractRowCard({ contract }: { contract: ContractRow }) {
  const facilityName =
    contract.facility_profiles?.facility_name ?? 'Unknown facility'
  const status = contract.status
  const statusLabel = STATUS_LABEL[status] ?? status

  return (
    <Link
      href={`/contractor/contracts/${contract.id}`}
      className="block rounded-xl transition-colors hover:bg-[#f9fafb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1dbf73]"
    >
      <Card size="sm">
        <CardContent className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold text-[#404145]">
                {facilityName}
              </h3>
              <p className="mt-0.5 truncate text-sm text-[#62646a]">
                {contract.title}
              </p>
            </div>
            <ContractStatusBadge status={status} label={statusLabel} />
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#62646a]">
            {contract.start_date && (
              <span>
                {formatDate(contract.start_date)}
                {contract.end_date
                  ? ` – ${formatDate(contract.end_date)}`
                  : ''}
              </span>
            )}
            {contract.rate_amount != null && (
              <>
                <span aria-hidden="true" className="text-[#6b7280]">
                  ·
                </span>
                <span>
                  {formatCurrency(contract.rate_amount)}
                  {contract.rate_type ? `/${contract.rate_type}` : ''}
                </span>
              </>
            )}
            <span aria-hidden="true" className="text-[#6b7280]">
              ·
            </span>
            <span>Created {formatDate(contract.created_at)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function ContractStatusBadge({
  status,
  label,
}: {
  status: string
  label: string
}) {
  if (status === 'active') {
    return (
      <Badge className="bg-[#e8faf1] text-[#0f8f56] hover:bg-[#e8faf1]">
        {label}
      </Badge>
    )
  }
  if (status === 'completed') {
    return <Badge variant="secondary">{label}</Badge>
  }
  if (status === 'pending_contractor' || status === 'pending_facility') {
    return <Badge variant="outline">{label}</Badge>
  }
  if (
    status === 'disputed' ||
    status === 'cancelled' ||
    status === 'terminated'
  ) {
    return <Badge variant="destructive">{label}</Badge>
  }
  return <Badge variant="outline">{label}</Badge>
}

function EmptyState({ kind }: { kind: 'active' | 'completed' | 'all' }) {
  const copy =
    kind === 'active'
      ? {
          title: 'No active contracts',
          body: 'When a facility signs a contract with you, it will show up here.',
        }
      : kind === 'completed'
        ? {
            title: 'No completed contracts yet',
            body: 'Completed engagements will appear here once your contracts wrap up.',
          }
        : {
            title: 'No contracts yet',
            body: 'Apply to jobs that match your specialty to get your first contract.',
          }

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-[#e8faf1] text-[#1dbf73]">
          <FileTextIcon className="size-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-[#404145]">
            {copy.title}
          </h3>
          <p className="text-sm text-[#62646a]">{copy.body}</p>
        </div>
        <Button
          className="bg-[#1dbf73] text-white hover:bg-[#19a463]"
          render={<Link href="/contractor/jobs" />}
        >
          <SearchIcon className="size-4" />
          Browse jobs
        </Button>
      </CardContent>
    </Card>
  )
}
