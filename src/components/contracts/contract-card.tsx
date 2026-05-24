import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { CalendarIcon, DollarSignIcon } from 'lucide-react'

export interface ContractCardData {
  id: string
  title: string
  status: string
  rate_amount: number | null
  rate_type: string | null
  start_date: string | null
  end_date: string | null
  created_at: string
}

interface ContractCardProps {
  contract: ContractCardData
  counterpartyName: string
  userRole: 'contractor' | 'facility'
}

const STATUS_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  active: 'default',
  completed: 'secondary',
  pending_contractor: 'outline',
  pending_facility: 'outline',
  draft: 'outline',
  cancelled: 'destructive',
  terminated: 'destructive',
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  completed: 'Completed',
  pending_contractor: 'Pending Contractor',
  pending_facility: 'Pending Facility',
  draft: 'Draft',
  cancelled: 'Cancelled',
  terminated: 'Terminated',
}

export function ContractCard({
  contract,
  counterpartyName,
  userRole,
}: ContractCardProps) {
  const detailHref =
    userRole === 'contractor'
      ? `/contractor/contracts/${contract.id}`
      : `/facility/contracts/${contract.id}`

  return (
    <Link href={detailHref}>
      <Card
        size="sm"
        className="cursor-pointer transition-colors hover:bg-muted/50"
      >
        <CardContent className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-medium">{contract.title}</h3>
              <p className="text-xs text-muted-foreground">
                {userRole === 'contractor' ? 'Facility' : 'Contractor'}:{' '}
                {counterpartyName}
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[contract.status] ?? 'outline'}>
              {STATUS_LABEL[contract.status] ?? contract.status}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {contract.rate_amount != null && (
              <span className="flex items-center gap-1">
                <DollarSignIcon className="size-3" />
                {formatCurrency(contract.rate_amount)}
                {contract.rate_type ? `/${contract.rate_type}` : ''}
              </span>
            )}
            {contract.start_date && (
              <span className="flex items-center gap-1">
                <CalendarIcon className="size-3" />
                {formatDate(contract.start_date)}
                {contract.end_date ? ` - ${formatDate(contract.end_date)}` : ''}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
