'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode, DEMO_CONTRACTS } from '@/lib/demo/data'
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
  ArrowLeft,
  Calendar,
  Building2,
  Loader2,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  ShieldAlert,
  FileSearch,
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

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  completed: 'Completed',
  pending_contractor: 'Pending Your Approval',
  pending_facility: 'Pending Facility Approval',
  draft: 'Draft',
  cancelled: 'Cancelled',
  terminated: 'Terminated',
  disputed: 'Disputed',
}

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABEL[status] ?? status
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
  if (status === 'pending_contractor' || status === 'pending_facility' || status === 'draft') {
    return <Badge variant="outline">{label}</Badge>
  }
  if (status === 'disputed' || status === 'cancelled' || status === 'terminated') {
    return <Badge variant="destructive">{label}</Badge>
  }
  return <Badge variant="outline">{label}</Badge>
}

function demoContractToDetail(contractId: string): ContractDetail | null {
  const demoContract = DEMO_CONTRACTS.find((c) => c.id === contractId)
  if (!demoContract) return null
  return {
    id: demoContract.id,
    title: demoContract.title,
    description: demoContract.description ?? null,
    status: demoContract.status,
    rate_amount: demoContract.agreed_rate ?? null,
    rate_type: demoContract.rate_type ?? null,
    terms: null,
    schedule: null,
    start_date: demoContract.start_date ?? null,
    end_date: demoContract.end_date ?? null,
    contractor_id: demoContract.contractor_id,
    facility_id: demoContract.facility_id,
    created_at: demoContract.created_at,
    facility_profiles: demoContract.facility
      ? { facility_name: demoContract.facility.facility_name }
      : null,
  }
}

export default function ContractorContractDetailPage() {
  const params = useParams()
  const contractId = params.id as string
  const isDemo = isDemoMode()

  const [contract, setContract] = useState<ContractDetail | null>(() =>
    isDemo ? demoContractToDetail(contractId) : null
  )
  const [timesheets, setTimesheets] = useState<TimesheetItem[]>([])
  const [loading, setLoading] = useState(!isDemo)
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
    if (isDemo) return

    let cancelled = false
    fetchData().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [isDemo, fetchData])

  const handleAccept = async () => {
    if (!contract) return
    setAccepting(true)
    try {
      if (isDemoMode()) {
        toast.success('Contract accepted! (demo mode)')
        setContract((prev) => prev ? { ...prev, status: 'active' } : prev)
        return
      }
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
        <Loader2 className="size-6 animate-spin text-[#1dbf73]" />
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="space-y-6">
        <Link
          href="/contractor/contracts"
          className="inline-flex items-center gap-1.5 text-sm text-[#62646a] hover:text-[#404145]"
        >
          <ArrowLeft className="size-4" />
          Back to contracts
        </Link>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-[#e8faf1]">
            <FileSearch className="size-6 text-[#1dbf73]" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-[#404145]">
            Contract not found
          </h3>
          <p className="mt-1 text-sm text-[#62646a]">
            We couldn&apos;t find the contract you&apos;re looking for.
          </p>
          <Button
            variant="outline"
            className="mt-6"
            render={<Link href="/contractor/contracts" />}
          >
            <ArrowLeft className="size-4" />
            Back to contracts
          </Button>
        </div>
      </div>
    )
  }

  const facilityName =
    contract.facility_profiles?.facility_name ?? 'Unknown Facility'

  const totalHours = timesheets.reduce(
    (sum, t) => sum + (Number((t as unknown as { hours_worked?: number }).hours_worked) || 0),
    0
  )
  const earnings =
    contract.rate_amount != null && contract.rate_type === 'hourly'
      ? totalHours * contract.rate_amount
      : null

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link
        href="/contractor/contracts"
        className="inline-flex items-center gap-1.5 text-sm text-[#62646a] hover:text-[#404145]"
      >
        <ArrowLeft className="size-4" />
        Back to contracts
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-[#404145]">
              {facilityName}
            </h1>
            <StatusBadge status={contract.status} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#62646a]">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="size-4" />
              {contract.title}
            </span>
            {contract.start_date && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-4" />
                {formatDate(contract.start_date)}
                {contract.end_date
                  ? ` – ${formatDate(contract.end_date)}`
                  : ' – Ongoing'}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {contract.status === 'pending_contractor' && (
            <Button
              onClick={handleAccept}
              disabled={accepting}
              className="bg-[#1dbf73] text-white hover:bg-[#19a463]"
            >
              {accepting && <Loader2 className="size-4 animate-spin" />}
              <CheckCircle2 className="size-4" />
              Accept Contract
            </Button>
          )}
          {contract.status === 'active' && (
            <Button variant="destructive">
              <ShieldAlert className="size-4" />
              Dispute
            </Button>
          )}
        </div>
      </div>

      {/* Awaiting approval banner */}
      {contract.status === 'pending_contractor' && (
        <Card className="border-[#bcebd5] bg-[#e8faf1]">
          <CardContent className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-[#0f8f56]" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#0f8f56]">
                Action required
              </p>
              <p className="text-sm text-[#404145]">
                This contract is awaiting your approval. Review the terms below
                and accept to get started.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
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
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-[#1dbf73]" />
                <CardTitle>Timesheets</CardTitle>
              </div>
              <CardDescription>
                Your submitted timesheets for this contract
              </CardDescription>
            </CardHeader>
            <CardContent>
              {timesheets.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#e5e7eb] bg-[#f9fafb] px-4 py-8 text-center">
                  <p className="text-sm text-[#62646a]">
                    No timesheets submitted yet.
                  </p>
                </div>
              ) : (
                <TimesheetTable
                  timesheets={timesheets}
                  userRole="contractor"
                />
              )}
            </CardContent>
          </Card>

          {/* Terms & description */}
          {(contract.description || contract.terms || contract.schedule) && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-[#1dbf73]" />
                  <CardTitle>Contract Terms</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {contract.description && (
                  <div>
                    <h3 className="mb-1 text-sm font-semibold text-[#404145]">
                      Description
                    </h3>
                    <p className="text-sm whitespace-pre-wrap text-[#62646a]">
                      {contract.description}
                    </p>
                  </div>
                )}
                {contract.description && (contract.terms || contract.schedule) && (
                  <Separator />
                )}
                {contract.terms && (
                  <div>
                    <h3 className="mb-1 text-sm font-semibold text-[#404145]">
                      Terms
                    </h3>
                    <p className="text-sm whitespace-pre-wrap text-[#62646a]">
                      {contract.terms}
                    </p>
                  </div>
                )}
                {contract.terms && contract.schedule && <Separator />}
                {contract.schedule && (
                  <div>
                    <h3 className="mb-1 text-sm font-semibold text-[#404145]">
                      Schedule
                    </h3>
                    <p className="text-sm whitespace-pre-wrap text-[#62646a]">
                      {contract.schedule}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Documents */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-[#1dbf73]" />
                <CardTitle>Documents</CardTitle>
              </div>
              <CardDescription>
                Signed contract and related attachments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-md bg-white ring-1 ring-[#e5e7eb]">
                    <FileText className="size-4 text-[#1dbf73]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#404145]">
                      Contract Agreement.pdf
                    </p>
                    <p className="text-xs text-[#6b7280]">
                      Generated {formatDate(contract.created_at)}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  <Download className="size-4" />
                  Download
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sticky summary */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[#62646a]">Facility</span>
                  <span className="font-medium text-[#404145] text-right">
                    {facilityName}
                  </span>
                </div>
                {contract.rate_amount != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#62646a]">Rate</span>
                    <span className="font-medium text-[#404145]">
                      {formatCurrency(contract.rate_amount)}
                      {contract.rate_type ? `/${contract.rate_type}` : ''}
                    </span>
                  </div>
                )}
                {contract.start_date && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#62646a]">Start</span>
                    <span className="font-medium text-[#404145]">
                      {formatDate(contract.start_date)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-[#62646a]">End</span>
                  <span className="font-medium text-[#404145]">
                    {contract.end_date ? formatDate(contract.end_date) : 'Ongoing'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#62646a]">Status</span>
                  <StatusBadge status={contract.status} />
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-[#62646a]">Hours logged</span>
                  <span className="font-medium text-[#404145]">
                    {totalHours.toFixed(1)} hrs
                  </span>
                </div>
                {earnings != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#62646a]">Estimated earnings</span>
                    <span className="font-semibold text-[#0f8f56]">
                      {formatCurrency(earnings)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment</CardTitle>
                <CardDescription>
                  Payouts release after timesheet approval
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[#62646a]">Submitted</span>
                  <span className="font-medium text-[#404145]">
                    {timesheets.length} {timesheets.length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#62646a]">Status</span>
                  <Badge variant="outline">Awaiting approval</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
