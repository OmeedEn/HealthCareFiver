'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  TimesheetForm,
} from '@/components/contracts/timesheet-form'
import {
  TimesheetTable,
  type TimesheetItem,
} from '@/components/contracts/timesheet-table'
import {
  formatCurrency,
  formatDate,
} from '@/lib/utils/format'
import {
  ArrowLeftIcon,
  CalendarIcon,
  DollarSignIcon,
  BuildingIcon,
  Loader2Icon,
} from 'lucide-react'
import { toast } from 'sonner'

interface ContractDetail {
  id: string
  title: string
  description: string | null
  status: string
  rate_amount: number | null
  rate_type: string | null
  terms: string | null
  schedule: string | null
  start_date: string | null
  end_date: string | null
  contractor_id: string
  facility_id: string
  created_at: string
  facility_profiles: {
    facility_name: string
  } | null
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
  pending_contractor: 'Pending Your Approval',
  pending_facility: 'Pending Facility Approval',
  draft: 'Draft',
  cancelled: 'Cancelled',
  terminated: 'Terminated',
}

export default function ContractorContractDetailPage() {
  const params = useParams()
  const contractId = params.id as string

  const [contract, setContract] = useState<ContractDetail | null>(null)
  const [timesheets, setTimesheets] = useState<TimesheetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)

  const fetchData = useCallback(async () => {
    const supabase = createClient()

    const { data: contractData, error } = await supabase
      .from('contracts')
      .select(
        '*, facility_profiles!inner(facility_name)'
      )
      .eq('id', contractId)
      .single()

    if (error || !contractData) {
      toast.error('Failed to load contract.')
      return
    }

    setContract(contractData as unknown as ContractDetail)

    const { data: tsData } = await supabase
      .from('timesheets')
      .select('*')
      .eq('contract_id', contractId)
      .order('shift_date', { ascending: false })

    setTimesheets((tsData ?? []) as unknown as TimesheetItem[])
  }, [contractId])

  useEffect(() => {
    setLoading(true)
    fetchData().finally(() => setLoading(false))
  }, [fetchData])

  const handleAccept = async () => {
    if (!contract) return
    setAccepting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('contracts')
        .update({ status: 'active' })
        .eq('id', contract.id)

      if (error) {
        toast.error('Failed to accept contract.')
        return
      }
      toast.success('Contract accepted!')
      fetchData()
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Contract not found.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          render={<Link href="/contractor/contracts" />}
        >
          <ArrowLeftIcon className="size-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {contract.title}
            </h1>
            <Badge variant={STATUS_VARIANT[contract.status] ?? 'outline'}>
              {STATUS_LABEL[contract.status] ?? contract.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Accept button for pending contracts */}
      {contract.status === 'pending_contractor' && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between">
            <p className="text-sm font-medium">
              This contract is awaiting your approval.
            </p>
            <Button onClick={handleAccept} disabled={accepting}>
              {accepting && <Loader2Icon className="size-4 animate-spin" />}
              Accept Contract
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Contract details */}
      <Card>
        <CardHeader>
          <CardTitle>Contract Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-sm">
              <BuildingIcon className="size-4 text-muted-foreground" />
              <span>
                {contract.facility_profiles?.facility_name ?? 'Unknown Facility'}
              </span>
            </div>
            {contract.rate_amount != null && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSignIcon className="size-4 text-muted-foreground" />
                <span>
                  {formatCurrency(contract.rate_amount)}
                  {contract.rate_type ? `/${contract.rate_type}` : ''}
                </span>
              </div>
            )}
            {contract.start_date && (
              <div className="flex items-center gap-2 text-sm">
                <CalendarIcon className="size-4 text-muted-foreground" />
                <span>
                  {formatDate(contract.start_date)}
                  {contract.end_date
                    ? ` - ${formatDate(contract.end_date)}`
                    : ' - Ongoing'}
                </span>
              </div>
            )}
          </div>

          {contract.description && (
            <>
              <Separator />
              <div>
                <h3 className="mb-1 text-sm font-medium">Description</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {contract.description}
                </p>
              </div>
            </>
          )}

          {contract.terms && (
            <div>
              <h3 className="mb-1 text-sm font-medium">Terms</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {contract.terms}
              </p>
            </div>
          )}

          {contract.schedule && (
            <div>
              <h3 className="mb-1 text-sm font-medium">Schedule</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {contract.schedule}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timesheet entry for active contracts */}
      {contract.status === 'active' && (
        <TimesheetForm
          contractId={contract.id}
          contractorId={contract.contractor_id}
          facilityId={contract.facility_id}
          onSuccess={fetchData}
        />
      )}

      {/* Timesheets list */}
      <Card>
        <CardHeader>
          <CardTitle>Timesheets</CardTitle>
          <CardDescription>Your submitted timesheets for this contract</CardDescription>
        </CardHeader>
        <CardContent>
          <TimesheetTable
            timesheets={timesheets}
            userRole="contractor"
          />
        </CardContent>
      </Card>
    </div>
  )
}
