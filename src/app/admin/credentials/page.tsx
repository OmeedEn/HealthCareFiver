'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  CheckCircle,
  XCircle,
  ExternalLink,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import {
  isDemoMode,
  DEMO_CREDENTIALS,
  DEMO_CONTRACTOR,
} from '@/lib/demo/data'

interface PendingCredential {
  id: string
  contractor_id: string
  credential_type: string
  name: string
  status: string
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
  const demo = isDemoMode()

  useEffect(() => {
    async function fetchCredentials() {
      if (demo) {
        const demoQueue = DEMO_CREDENTIALS.filter(
          (c) =>
            c.status === 'pending_review' || c.status === 'pending_upload'
        ).map((c) => ({
          id: c.id,
          contractor_id: c.contractor_id,
          credential_type: c.credential_type,
          name: c.name,
          status: c.status,
          document_url: c.document_url,
          created_at:
            c.verified_at ?? c.issued_date ?? new Date().toISOString(),
          contractor_profiles: {
            first_name: DEMO_CONTRACTOR.first_name,
            last_name: DEMO_CONTRACTOR.last_name,
          },
        })) as PendingCredential[]
        setCredentials(demoQueue)
        setLoading(false)
        return
      }

      // Defer createClient() until after the demo check — calling it in the
      // component body throws "Supabase is not configured" during the static
      // prerender pass at build time.
      const supabase = createClient()
      const { data } = await supabase
        .from('credentials')
        .select(
          'id, contractor_id, credential_type, name, status, document_url, created_at, contractor_profiles!contractor_id(first_name, last_name)'
        )
        .in('status', ['pending_review', 'pending_upload'])
        .order('created_at', { ascending: true })

      setCredentials((data ?? []) as unknown as PendingCredential[])
      setLoading(false)
    }

    fetchCredentials()
  }, [demo])

  async function handleApprove(credentialId: string) {
    setProcessing(credentialId)
    try {
      if (demo) {
        await new Promise((r) => setTimeout(r, 300))
        setCredentials((prev) => prev.filter((c) => c.id !== credentialId))
        toast.success('Credential approved')
        return
      }

      const supabase = createClient()
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
      if (demo) {
        await new Promise((r) => setTimeout(r, 300))
        setCredentials((prev) => prev.filter((c) => c.id !== rejectId))
        toast.success('Credential rejected')
        setRejectDialogOpen(false)
        setRejectId(null)
        setRejectNotes('')
        return
      }

      const supabase = createClient()
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
      <div className="flex items-center justify-center py-20 font-sans">
        <Loader2 className="size-6 animate-spin text-[#1dbf73]" />
      </div>
    )
  }

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-[#404145]">
            Credential Review Queue
          </h1>
          <p className="text-sm text-[#62646a]">
            Verify contractor licenses, certifications, and compliance documents.
          </p>
        </div>
        <Badge variant="secondary">{credentials.length} pending</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[#404145]">Pending Credentials</CardTitle>
        </CardHeader>
        <CardContent>
          {credentials.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-[#e8faf1]">
                <ShieldCheck className="size-6 text-[#0f8f56]" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#404145]">
                  Queue is clear
                </p>
                <p className="text-sm text-[#6b7280]">
                  Nothing to review right now. New submissions will appear here.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              {credentials.map((credential) => (
                <div
                  key={credential.id}
                  className="flex items-start gap-3 border-b border-[#f1f3f5] py-3 last:border-0"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#e8faf1]">
                    <ShieldCheck className="size-5 text-[#0f8f56]" />
                  </div>
                  <div className="flex flex-1 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[#404145]">
                          {credential.contractor_profiles?.first_name ?? ''}{' '}
                          {credential.contractor_profiles?.last_name ?? ''}
                        </p>
                        <Badge
                          variant={
                            credential.status === 'pending_review'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {credential.status === 'pending_review'
                            ? 'Pending review'
                            : 'Pending upload'}
                        </Badge>
                      </div>
                      <p className="text-sm text-[#62646a]">
                        {credential.name}
                        <span className="text-[#6b7280]">
                          {' '}
                          · {credential.credential_type}
                        </span>
                      </p>
                      <p className="text-xs text-[#6b7280]">
                        Submitted {formatDate(credential.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
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
                          <ExternalLink
                            className="size-3"
                            data-icon="inline-start"
                          />
                          View
                        </Button>
                      ) : (
                        <span className="text-xs text-[#6b7280]">
                          No document
                        </span>
                      )}
                      <Button
                        size="xs"
                        disabled={processing === credential.id}
                        onClick={() => handleApprove(credential.id)}
                        className="bg-[#1dbf73] text-white hover:bg-[#19a463]"
                      >
                        {processing === credential.id ? (
                          <Loader2
                            className="size-3 animate-spin"
                            data-icon="inline-start"
                          />
                        ) : (
                          <CheckCircle
                            className="size-3"
                            data-icon="inline-start"
                          />
                        )}
                        Approve
                      </Button>
                      <Button
                        size="xs"
                        variant="destructive"
                        disabled={processing === credential.id}
                        onClick={() => openRejectDialog(credential.id)}
                      >
                        <XCircle
                          className="size-3"
                          data-icon="inline-start"
                        />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="font-sans">
          <DialogHeader>
            <DialogTitle className="text-[#404145]">
              Reject Credential
            </DialogTitle>
            <DialogDescription className="text-[#62646a]">
              Provide a reason for rejecting this credential. The contractor
              will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-notes" className="text-[#404145]">
              Rejection Notes
            </Label>
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
                <Loader2
                  className="size-4 animate-spin"
                  data-icon="inline-start"
                />
              )}
              Reject Credential
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
