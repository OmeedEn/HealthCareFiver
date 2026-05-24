'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CREDENTIAL_TYPE_LABELS } from '@/lib/utils/constants'
import { formatDate } from '@/lib/utils/format'
import { AlertTriangle, ExternalLink, ShieldCheck, Clock, XCircle } from 'lucide-react'

export interface CredentialData {
  id: string
  contractor_id: string
  credential_type: string
  name: string
  issuing_authority: string | null
  license_number: string | null
  issued_date: string | null
  expiration_date: string | null
  status: string
  document_url: string | null
  document_filename: string | null
}

interface CredentialCardProps {
  credential: CredentialData
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  verified: {
    label: 'Verified',
    variant: 'default',
    icon: <ShieldCheck className="size-3" />,
  },
  pending_upload: {
    label: 'Pending Upload',
    variant: 'outline',
    icon: <Clock className="size-3" />,
  },
  pending_review: {
    label: 'Pending Review',
    variant: 'secondary',
    icon: <Clock className="size-3" />,
  },
  rejected: {
    label: 'Rejected',
    variant: 'destructive',
    icon: <XCircle className="size-3" />,
  },
  expired: {
    label: 'Expired',
    variant: 'destructive',
    icon: <AlertTriangle className="size-3" />,
  },
  expiring_soon: {
    label: 'Expiring Soon',
    variant: 'destructive',
    icon: <AlertTriangle className="size-3" />,
  },
}

export function CredentialCard({ credential }: CredentialCardProps) {
  const status = statusConfig[credential.status] ?? {
    label: credential.status,
    variant: 'outline' as const,
    icon: null,
  }

  const isWarning = credential.status === 'expired' || credential.status === 'expiring_soon'

  return (
    <Card className={isWarning ? 'border-destructive/50' : undefined}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              {isWarning && <AlertTriangle className="size-4 shrink-0 text-destructive" />}
              <span className="truncate">{credential.name}</span>
            </CardTitle>
            <Badge variant="outline" className="mt-1">
              {CREDENTIAL_TYPE_LABELS[credential.credential_type] ?? credential.credential_type}
            </Badge>
          </div>
          <Badge variant={status.variant} className="shrink-0">
            {status.icon}
            {status.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {credential.issuing_authority && (
            <>
              <dt className="text-muted-foreground">Issuing Authority</dt>
              <dd>{credential.issuing_authority}</dd>
            </>
          )}
          {credential.license_number && (
            <>
              <dt className="text-muted-foreground">License #</dt>
              <dd>{credential.license_number}</dd>
            </>
          )}
          {credential.issued_date && (
            <>
              <dt className="text-muted-foreground">Issued</dt>
              <dd>{formatDate(credential.issued_date)}</dd>
            </>
          )}
          {credential.expiration_date && (
            <>
              <dt className="text-muted-foreground">Expires</dt>
              <dd className={isWarning ? 'font-medium text-destructive' : ''}>
                {formatDate(credential.expiration_date)}
              </dd>
            </>
          )}
        </dl>
        {credential.document_url && (
          <a
            href={credential.document_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <ExternalLink className="size-3.5" />
            View Document
          </a>
        )}
      </CardContent>
    </Card>
  )
}
