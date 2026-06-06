'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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
import { Loader2, Eye, CheckCircle } from 'lucide-react'

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

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-red-100 text-red-800' },
  under_review: { label: 'Under Review', className: 'bg-yellow-100 text-yellow-800' },
  resolved: { label: 'Resolved', className: 'bg-green-100 text-green-800' },
  dismissed: { label: 'Dismissed', className: 'bg-gray-100 text-gray-800' },
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
  const supabase = createClient()

  useEffect(() => {
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
  }, [supabase])

  async function handleMarkUnderReview(disputeId: string) {
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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dispute Management</h1>

      <Card>
        <CardHeader>
          <CardTitle>All Disputes</CardTitle>
        </CardHeader>
        <CardContent>
          {disputes.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No disputes found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract</TableHead>
                  <TableHead>Opened By</TableHead>
                  <TableHead>Against</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputes.map((dispute) => {
                  const config = statusConfig[dispute.status] ?? {
                    label: dispute.status,
                    className: '',
                  }
                  return (
                    <TableRow key={dispute.id}>
                      <TableCell className="font-medium">
                        {dispute.contracts?.title ?? 'N/A'}
                      </TableCell>
                      <TableCell>{dispute.opened_by_name}</TableCell>
                      <TableCell>{dispute.against_name}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {dispute.reason}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={config.className}>
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(dispute.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {dispute.status === 'open' && (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() =>
                                handleMarkUnderReview(dispute.id)
                              }
                            >
                              <Eye className="size-3" data-icon="inline-start" />
                              Review
                            </Button>
                          )}
                          {(dispute.status === 'open' ||
                            dispute.status === 'under_review') && (
                            <Button
                              size="xs"
                              variant="default"
                              onClick={() => openResolveDialog(dispute)}
                            >
                              <CheckCircle className="size-3" data-icon="inline-start" />
                              Resolve
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Dispute</DialogTitle>
            <DialogDescription>
              Provide resolution notes for this dispute. Both parties will be
              notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="resolution-notes">Resolution Notes</Label>
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
            <Button onClick={handleResolve} disabled={processing}>
              {processing && (
                <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
              )}
              Resolve Dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
