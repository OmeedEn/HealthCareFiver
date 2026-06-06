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
import { CheckCircle, XCircle, ExternalLink, Loader2 } from 'lucide-react'

interface PendingCredential {
  id: string
  contractor_id: string
  credential_type: string
  name: string
  document_url: string | null
  created_at: string
  contractor_profiles: {
    first_name: string
    last_name: string
  } | null
}

export default function AdminCredentialsPage() {
  const [credentials, setCredentials] = useState<PendingCredential[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function fetchCredentials() {
      const { data } = await supabase
        .from('credentials')
        .select(
          'id, contractor_id, credential_type, name, document_url, created_at, contractor_profiles!contractor_id(first_name, last_name)'
        )
        .eq('status', 'pending_review')
        .order('created_at', { ascending: true })

      setCredentials((data ?? []) as unknown as PendingCredential[])
      setLoading(false)
    }

    fetchCredentials()
  }, [supabase])

  async function handleApprove(credentialId: string) {
    setProcessing(credentialId)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { error } = await supabase
        .from('credentials')
        .update({
          status: 'verified',
          verified_at: new Date().toISOString(),
          verified_by: user?.id ?? null,
        })
        .eq('id', credentialId)

      if (error) throw error

      setCredentials((prev) => prev.filter((c) => c.id !== credentialId))
      toast.success('Credential approved')
    } catch {
      toast.error('Failed to approve credential')
    } finally {
      setProcessing(null)
    }
  }

  async function handleReject() {
    if (!rejectId) return

    setProcessing(rejectId)
    try {
      const { error } = await supabase
        .from('credentials')
        .update({
          status: 'rejected',
          rejection_notes: rejectNotes.trim() || null,
        })
        .eq('id', rejectId)

      if (error) throw error

      setCredentials((prev) => prev.filter((c) => c.id !== rejectId))
      toast.success('Credential rejected')
      setRejectDialogOpen(false)
      setRejectId(null)
      setRejectNotes('')
    } catch {
      toast.error('Failed to reject credential')
    } finally {
      setProcessing(null)
    }
  }

  function openRejectDialog(credentialId: string) {
    setRejectId(credentialId)
    setRejectNotes('')
    setRejectDialogOpen(true)
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Credential Review Queue</h1>
        <Badge variant="secondary">{credentials.length} pending</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Credentials</CardTitle>
        </CardHeader>
        <CardContent>
          {credentials.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No credentials pending review.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contractor</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {credentials.map((credential) => (
                  <TableRow key={credential.id}>
                    <TableCell className="font-medium">
                      {credential.contractor_profiles?.first_name ?? ''}{' '}
                      {credential.contractor_profiles?.last_name ?? ''}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {credential.credential_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{credential.name}</TableCell>
                    <TableCell>{formatDate(credential.created_at)}</TableCell>
                    <TableCell>
                      {credential.document_url ? (
                        <Button
                          variant="ghost"
                          size="xs"
                          render={
                            <a
                              href={credential.document_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          }
                        >
                          <ExternalLink className="size-3" data-icon="inline-start" />
                          View
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          No document
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="xs"
                          variant="default"
                          disabled={processing === credential.id}
                          onClick={() => handleApprove(credential.id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {processing === credential.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <CheckCircle className="size-3" data-icon="inline-start" />
                          )}
                          Approve
                        </Button>
                        <Button
                          size="xs"
                          variant="destructive"
                          disabled={processing === credential.id}
                          onClick={() => openRejectDialog(credential.id)}
                        >
                          <XCircle className="size-3" data-icon="inline-start" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Credential</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this credential. The contractor
              will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-notes">Rejection Notes</Label>
            <Textarea
              id="reject-notes"
              placeholder="Reason for rejection..."
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processing !== null}
            >
              {processing && (
                <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
              )}
              Reject Credential
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
