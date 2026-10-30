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
import Link from 'next/link'
import {
  CheckCircle,
  XCircle,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Mail,
  Phone,
  User,
  MessageSquare,
} from 'lucide-react'
import {
  isDemoMode,
  DEMO_CREDENTIALS,
  DEMO_CONTRACTOR,
} from '@/lib/demo/data'
import { credentialDocumentHref } from '@/lib/credentials/document'
import { getCredentialContacts } from './actions'

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
  email?: string | null
  phone?: string | null
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

      const rows = (data ?? []) as unknown as PendingCredential[]

      // Pull contact info so the admin can reach out about missing documents.
      const ids = [...new Set(rows.map((r) => r.contractor_id))]
      if (ids.length) {
        const contacts = await getCredentialContacts(ids).catch(() => ({}) as Awaited<ReturnType<typeof getCredentialContacts>>)
        for (const r of rows) {
          r.email = contacts[r.contractor_id]?.email ?? null
          r.phone = contacts[r.contractor_id]?.phone ?? null
        }
      }

      setCredentials(rows)
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
                        <Link
                          href={`/admin/users/${credential.contractor_id}`}
                          className="text-sm font-semibold text-[#404145] hover:text-[#1dbf73] hover:underline"
                        >
                          {credential.contractor_profiles?.first_name ?? ''}{' '}
                          {credential.contractor_profiles?.last_name ?? ''}
                        </Link>
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
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs">
                        {credential.email && (
                          <a
                            href={`mailto:${credential.email}?subject=${encodeURIComponent(`Your ${credential.name} credential`)}`}
                            className="inline-flex items-center gap-1 text-[#0f8f56] hover:underline"
                          >
                            <Mail className="size-3" />
                            {credential.email}
                          </a>
                        )}
                        {credential.phone && (
                          <a
                            href={`tel:${credential.phone}`}
                            className="inline-flex items-center gap-1 text-[#0f8f56] hover:underline"
                          >
                            <Phone className="size-3" />
                            {credential.phone}
                          </a>
                        )}
                        <Link
                          href={`/admin/messages/${credential.contractor_id}`}
                          className="inline-flex items-center gap-1 font-medium text-[#0f8f56] hover:underline"
                        >
                          <MessageSquare className="size-3" />
                          Message in app
                        </Link>
                        <Link
                          href={`/admin/users/${credential.contractor_id}`}
                          className="inline-flex items-center gap-1 text-[#62646a] hover:text-[#1dbf73] hover:underline"
                        >
                          <User className="size-3" />
                          Full profile
                        </Link>
                        <Link
                          href={`/admin/verification/${credential.contractor_id}`}
                          className="inline-flex items-center gap-1 text-[#62646a] hover:text-[#1dbf73] hover:underline"
                        >
                          <ShieldCheck className="size-3" />
                          Verification review
                        </Link>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {credential.document_url ? (
                        <Button
                          variant="ghost"
                          size="xs"
                          render={
                            <a
                              href={credentialDocumentHref(credential.id)}
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
