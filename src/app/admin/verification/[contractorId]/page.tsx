'use client'

import { use, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
import { DocumentViewer } from '@/components/admin/document-viewer'
import { formatDateTime } from '@/lib/utils/format'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CheckCircle,
  FileText,
  Loader2,
  MessageCircleQuestion,
  RefreshCw,
  XCircle,
} from 'lucide-react'

interface ProviderDetail {
  id: string
  first_name: string
  last_name: string
  contractor_type: string
  npi_number: string | null
  state_license_number: string | null
  license_state: string | null
  city: string | null
  state: string | null
  verification_status: string
  verification_notes: string | null
  verification_reviewed_at: string | null
  baa_sent_at: string | null
  approval_email_sent_at: string | null
  profiles: { email: string | null } | null
}

interface CredentialDoc {
  id: string
  credential_type: string
  name: string
  document_url: string | null
  document_filename: string | null
  status: string
  created_at: string
}

interface VerificationCheck {
  id: string
  check_type: 'medallion' | 'checkr' | 'stripe_identity'
  status: string
  result_summary: Record<string, unknown> | null
  checked_at: string | null
}

const CHECK_LABELS: Record<VerificationCheck['check_type'], string> = {
  medallion: 'Medallion',
  checkr: 'Checkr Background Check',
  stripe_identity: 'Stripe Identity',
}

const CHECK_STATUS_BADGE: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  not_started: 'outline',
  pending: 'secondary',
  passed: 'default',
  failed: 'destructive',
  needs_review: 'secondary',
}

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending_review: 'secondary',
  more_info_requested: 'outline',
  approved: 'default',
  rejected: 'destructive',
}

export default function AdminVerificationDetailPage({
  params,
}: {
  params: Promise<{ contractorId: string }>
}) {
  const { contractorId } = use(params)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [provider, setProvider] = useState<ProviderDetail | null>(null)
  const [credentials, setCredentials] = useState<CredentialDoc[]>([])
  const [checks, setChecks] = useState<VerificationCheck[]>([])
  const [selectedCredentialId, setSelectedCredentialId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [runningCheck, setRunningCheck] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [dialogAction, setDialogAction] = useState<'request_info' | 'reject' | null>(null)
  const [dialogNotes, setDialogNotes] = useState('')

  useEffect(() => {
    async function fetchAll() {
      const [providerRes, credentialsRes, checksRes] = await Promise.all([
        supabase
          .from('contractor_profiles')
          .select(
            'id, first_name, last_name, contractor_type, npi_number, state_license_number, license_state, city, state, verification_status, verification_notes, verification_reviewed_at, baa_sent_at, approval_email_sent_at, profiles(email)'
          )
          .eq('id', contractorId)
          .single(),
        supabase
          .from('credentials')
          .select('id, credential_type, name, document_url, document_filename, status, created_at')
          .eq('contractor_id', contractorId)
          .order('created_at', { ascending: false }),
        supabase
          .from('provider_verification_checks')
          .select('id, check_type, status, result_summary, checked_at')
          .eq('contractor_id', contractorId),
      ])

      setProvider((providerRes.data ?? null) as unknown as ProviderDetail | null)
      const docs = (credentialsRes.data ?? []) as unknown as CredentialDoc[]
      setCredentials(docs)
      setSelectedCredentialId(docs[0]?.id ?? null)
      setChecks((checksRes.data ?? []) as unknown as VerificationCheck[])
      setLoading(false)
    }

    fetchAll()
  }, [supabase, contractorId])

  const selectedCredential = credentials.find((c) => c.id === selectedCredentialId) ?? null

  function checkFor(type: VerificationCheck['check_type']): VerificationCheck | null {
    return checks.find((c) => c.check_type === type) ?? null
  }

  async function runCheck(checkType: VerificationCheck['check_type']) {
    setRunningCheck(checkType)
    try {
      const res = await fetch(`/api/admin/verification/${contractorId}/checks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to run check')

      setChecks((prev) => {
        const next = prev.filter((c) => c.check_type !== checkType)
        return [...next, data.check as VerificationCheck]
      })
      toast.success(`${CHECK_LABELS[checkType]} check updated`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to run check')
    } finally {
      setRunningCheck(null)
    }
  }

  async function submitAction(action: 'approve' | 'request_info' | 'reject', notes?: string) {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/verification/${contractorId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit decision')

      if (data.warnings?.length) {
        data.warnings.forEach((w: string) => toast.warning(w))
      }
      toast.success('Verification decision saved')
      router.push('/admin/verification')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit decision')
      setSubmitting(false)
    }
  }

  function openDialog(action: 'request_info' | 'reject') {
    setDialogNotes('')
    setDialogAction(action)
  }

  async function confirmDialog() {
    if (!dialogAction || !dialogNotes.trim()) return
    await submitAction(dialogAction, dialogNotes.trim())
    setDialogAction(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!provider) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Provider not found.
      </div>
    )
  }

  const isDecided = provider.verification_status === 'approved' || provider.verification_status === 'rejected'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" render={<Link href="/admin/verification" />}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">
              {provider.first_name} {provider.last_name}
            </h1>
            <Badge variant={STATUS_BADGE[provider.verification_status] ?? 'secondary'}>
              {provider.verification_status.replace(/_/g, ' ')}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {provider.contractor_type.toUpperCase()} · {provider.profiles?.email ?? 'no email on file'}
            {provider.city && provider.state ? ` · ${provider.city}, ${provider.state}` : ''}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">NPI Number</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{provider.npi_number ?? '—'}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">License</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {provider.state_license_number
              ? `${provider.state_license_number} (${provider.license_state ?? '—'})`
              : '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Prior Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{provider.verification_notes ?? '—'}</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {credentials.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents uploaded.</p>
            ) : (
              credentials.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => setSelectedCredentialId(doc.id)}
                  className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    doc.id === selectedCredentialId
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent hover:bg-muted'
                  }`}
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{doc.name}</span>
                  <Badge variant="outline">{doc.status.replace(/_/g, ' ')}</Badge>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent className="h-125">
            <DocumentViewer
              documentUrl={selectedCredential?.document_url ?? null}
              filename={selectedCredential?.document_filename ?? null}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {(['medallion', 'checkr', 'stripe_identity'] as const).map((type) => {
          const check = checkFor(type)
          return (
            <Card key={type}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{CHECK_LABELS[type]}</CardTitle>
                <Badge variant={CHECK_STATUS_BADGE[check?.status ?? 'not_started']}>
                  {(check?.status ?? 'not_started').replace(/_/g, ' ')}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {check?.result_summary ? (
                  <pre className="max-h-32 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">
                    {JSON.stringify(check.result_summary, null, 2)}
                  </pre>
                ) : (
                  <p className="text-xs text-muted-foreground">No result yet.</p>
                )}
                {check?.checked_at && (
                  <p className="text-xs text-muted-foreground">
                    Checked {formatDateTime(check.checked_at)}
                  </p>
                )}
                <Button
                  variant="outline"
                  size="xs"
                  disabled={runningCheck === type}
                  onClick={() => runCheck(type)}
                >
                  {runningCheck === type ? (
                    <Loader2 className="size-3 animate-spin" data-icon="inline-start" />
                  ) : (
                    <RefreshCw className="size-3" data-icon="inline-start" />
                  )}
                  {check ? 'Refresh' : 'Run check'}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {!isDecided && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-end gap-2 py-4">
            <Button
              variant="outline"
              disabled={submitting}
              onClick={() => openDialog('request_info')}
            >
              <MessageCircleQuestion className="size-4" data-icon="inline-start" />
              Request More Info
            </Button>
            <Button
              variant="destructive"
              disabled={submitting}
              onClick={() => openDialog('reject')}
            >
              <XCircle className="size-4" data-icon="inline-start" />
              Reject
            </Button>
            <Button
              disabled={submitting}
              onClick={() => submitAction('approve')}
              className="bg-green-600 hover:bg-green-700"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
              ) : (
                <CheckCircle className="size-4" data-icon="inline-start" />
              )}
              Approve
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogAction !== null} onOpenChange={(open) => !open && setDialogAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === 'reject' ? 'Reject Provider' : 'Request More Information'}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === 'reject'
                ? 'Provide a reason for rejecting this provider. They will be notified by email.'
                : 'Describe what additional information or documents are needed. The provider will be notified by email.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="dialog-notes">Message</Label>
            <Textarea
              id="dialog-notes"
              value={dialogNotes}
              onChange={(e) => setDialogNotes(e.target.value)}
              rows={4}
              placeholder={
                dialogAction === 'reject'
                  ? 'Reason for rejection...'
                  : 'What do you need from the provider?'
              }
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAction(null)}>
              Cancel
            </Button>
            <Button
              variant={dialogAction === 'reject' ? 'destructive' : 'default'}
              disabled={submitting || !dialogNotes.trim()}
              onClick={confirmDialog}
            >
              {submitting && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
              {dialogAction === 'reject' ? 'Reject Provider' : 'Send Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
