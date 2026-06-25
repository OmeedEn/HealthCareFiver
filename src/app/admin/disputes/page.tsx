'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/data'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { formatDate } from '@/lib/utils/format'
import { toast } from 'sonner'
import { Loader2, Eye, CheckCircle, Shield } from 'lucide-react'

interface Dispute {
  id: string
  reason: string
  status: string
  resolution: string | null
  created_at: string
  contracts: { title: string } | null
  opened_by: string
  against: string
}

interface DisplayDispute extends Dispute {
  opened_by_name: string
  against_name: string
}

const DEMO_DISPUTES = [
  {
    id: 'dispute-1',
    contract_id: 'contract-1',
    contract_title: 'ICU RN Night Shift',
    opened_by_name: 'Sarah Johnson',
    against_name: 'Northline Medical Center',
    status: 'open',
    reason: 'Unpaid overtime hours',
    description:
      'Worked 4 hours of overtime on May 20 that were not included in the timesheet.',
    created_at: '2026-05-22T14:00:00Z',
  },
  {
    id: 'dispute-2',
    contract_id: 'contract-2',
    contract_title: 'Per Diem CNA Coverage',
    opened_by_name: 'Karen Williams',
    against_name: 'Greenway Assisted Living',
    status: 'under_review',
    reason: 'Schedule discrepancy',
    description: 'Facility schedule did not match the agreed-upon shifts.',
    created_at: '2026-05-20T09:00:00Z',
  },
]

function renderStatusBadge(status: string) {
  switch (status) {
    case 'open':
      return <Badge variant="destructive">Open</Badge>
    case 'under_review':
      return <Badge variant="secondary">Under Review</Badge>
    case 'resolved':
    case 'resolved_contractor':
    case 'resolved_facility':
      return (
        <Badge
          variant="outline"
          className="border-transparent bg-[#e8faf1] text-[#0f8f56]"
        >
          Resolved
        </Badge>
      )
    case 'escalated':
      return (
        <Badge
          variant="outline"
          className="border-transparent bg-amber-100 text-amber-800"
        >
          Escalated
        </Badge>
      )
    case 'closed':
      return <Badge variant="outline">Closed</Badge>
    case 'dismissed':
      return <Badge variant="outline">Dismissed</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

async function loadNames(
  supabase: ReturnType<typeof createClient>,
  ids: string[]
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids)).filter(Boolean)
  if (unique.length === 0) return new Map()

  const [contractors, facilities] = await Promise.all([
    supabase
      .from('contractor_profiles')
      .select('id, first_name, last_name')
      .in('id', unique),
    supabase
      .from('facility_profiles')
      .select('id, facility_name')
      .in('id', unique),
  ])

  const names = new Map<string, string>()
  for (const row of contractors.data ?? []) {
    names.set(row.id, `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim())
  }
  for (const row of facilities.data ?? []) {
    if (!names.has(row.id)) names.set(row.id, row.facility_name ?? '')
  }
  return names
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<DisplayDispute[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false)
  const [selectedDispute, setSelectedDispute] = useState<DisplayDispute | null>(
    null
  )
  const [resolutionNotes, setResolutionNotes] = useState('')
  const demo = isDemoMode()

  useEffect(() => {
    if (demo) {
      setDisputes(
        DEMO_DISPUTES.map((d) => ({
          id: d.id,
          reason: d.reason,
          status: d.status,
          resolution: null,
          created_at: d.created_at,
          contracts: { title: d.contract_title },
          opened_by: d.id,
          against: d.id,
          opened_by_name: d.opened_by_name,
          against_name: d.against_name,
        }))
      )
      setLoading(false)
      return
    }

    // createClient() must be deferred until after the demo check — calling
    // it at the top of the component body throws "Supabase is not configured"
    // during the static prerender pass at build time when env vars are unset.
    const supabase = createClient()

    async function fetchDisputes() {
      const { data } = await supabase
        .from('disputes')
        .select(
          'id, reason, status, resolution, created_at, opened_by, against, contracts(title)'
        )
        .order('created_at', { ascending: false })

      const rows = (data ?? []) as unknown as Dispute[]
      const names = await loadNames(
        supabase,
        rows.flatMap((d) => [d.opened_by, d.against])
      )

      setDisputes(
        rows.map((d) => ({
          ...d,
          opened_by_name: names.get(d.opened_by) ?? '—',
          against_name: names.get(d.against) ?? '—',
        }))
      )
      setLoading(false)
    }

    fetchDisputes()
  }, [demo])

  async function handleMarkUnderReview(disputeId: string) {
    if (demo) {
      setDisputes((prev) =>
        prev.map((d) =>
          d.id === disputeId ? { ...d, status: 'under_review' } : d
        )
      )
      toast.success('Dispute marked as under review')
      return
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('disputes')
      .update({ status: 'under_review' })
      .eq('id', disputeId)

    if (error) {
      toast.error('Failed to update dispute status')
    } else {
      toast.success('Dispute marked as under review')
      setDisputes((prev) =>
        prev.map((d) =>
          d.id === disputeId ? { ...d, status: 'under_review' } : d
        )
      )
    }
  }

  function openResolveDialog(dispute: DisplayDispute) {
    setSelectedDispute(dispute)
    setResolutionNotes('')
    setResolveDialogOpen(true)
  }

  async function handleResolve() {
    if (!selectedDispute) return

    setProcessing(true)
    try {
      const notes = resolutionNotes.trim() || null

      if (demo) {
        setDisputes((prev) =>
          prev.map((d) =>
            d.id === selectedDispute.id
              ? { ...d, status: 'resolved', resolution: notes }
              : d
          )
        )
        toast.success('Dispute resolved')
        setResolveDialogOpen(false)
        setSelectedDispute(null)
        return
      }

      const supabase = createClient()
      const { error } = await supabase
        .from('disputes')
        .update({
          status: 'resolved',
          resolution: notes,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', selectedDispute.id)

      if (error) throw error

      setDisputes((prev) =>
        prev.map((d) =>
          d.id === selectedDispute.id
            ? { ...d, status: 'resolved', resolution: notes }
            : d
        )
      )
      toast.success('Dispute resolved')
      setResolveDialogOpen(false)
      setSelectedDispute(null)
    } catch {
      toast.error('Failed to resolve dispute')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 font-sans">
        <Loader2 className="size-6 animate-spin text-[#1dbf73]" />
      </div>
    )
  }

  return (
    <div className="space-y-6 font-sans">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-[#404145]">
          Dispute Management
        </h1>
        <p className="text-sm text-[#62646a]">
          Review and resolve open contract and payment disputes between
          contractors and facilities.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[#404145]">All Disputes</CardTitle>
        </CardHeader>
        <CardContent>
          {disputes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-[#e8faf1]">
                <Shield className="size-6 text-[#1dbf73]" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-[#404145]">
                  No open disputes
                </p>
                <p className="text-sm text-[#6b7280]">
                  All clear — every dispute has been resolved or closed.
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[#404145]">Contract</TableHead>
                  <TableHead className="text-[#404145]">Opened By</TableHead>
                  <TableHead className="text-[#404145]">Against</TableHead>
                  <TableHead className="text-[#404145]">Reason</TableHead>
                  <TableHead className="text-[#404145]">Status</TableHead>
                  <TableHead className="text-[#404145]">Date</TableHead>
                  <TableHead className="text-[#404145]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputes.map((dispute) => (
                  <TableRow key={dispute.id}>
                    <TableCell className="font-medium text-[#404145]">
                      {dispute.contracts?.title ?? 'N/A'}
                    </TableCell>
                    <TableCell className="text-[#62646a]">
                      {dispute.opened_by_name}
                    </TableCell>
                    <TableCell className="text-[#62646a]">
                      {dispute.against_name}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-[#62646a]">
                      {dispute.reason}
                    </TableCell>
                    <TableCell>{renderStatusBadge(dispute.status)}</TableCell>
                    <TableCell className="text-[#62646a]">
                      {formatDate(dispute.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {dispute.status === 'open' && (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => handleMarkUnderReview(dispute.id)}
                          >
                            <Eye
                              className="size-3"
                              data-icon="inline-start"
                            />
                            Review
                          </Button>
                        )}
                        {(dispute.status === 'open' ||
                          dispute.status === 'under_review') && (
                          <Button
                            size="xs"
                            variant="default"
                            className="bg-[#1dbf73] text-white hover:bg-[#19a463]"
                            onClick={() => openResolveDialog(dispute)}
                          >
                            <CheckCircle
                              className="size-3"
                              data-icon="inline-start"
                            />
                            Resolve
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="font-sans">
          <DialogHeader>
            <DialogTitle className="text-[#404145]">
              Resolve Dispute
            </DialogTitle>
            <DialogDescription className="text-[#62646a]">
              Provide resolution notes for this dispute. Both parties will be
              notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="resolution-notes" className="text-[#404145]">
              Resolution Notes
            </Label>
            <Textarea
              id="resolution-notes"
              placeholder="Describe the resolution..."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResolveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={processing}
              className="bg-[#1dbf73] text-white hover:bg-[#19a463]"
            >
              {processing && (
                <Loader2
                  className="size-4 animate-spin"
                  data-icon="inline-start"
                />
              )}
              Resolve Dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
