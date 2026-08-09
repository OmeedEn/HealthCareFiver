import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CredentialCard } from '@/components/contractor/credential-card'
import type { CredentialData } from '@/components/contractor/credential-card'
import {
  Plus,
  ShieldCheck,
  Clock,
  AlertTriangle,
  FileX,
  ListChecks,
} from 'lucide-react'
import { isDemoMode, DEMO_CREDENTIALS, DEMO_REQUIRED_CREDENTIALS } from '@/lib/demo/data'

interface RequiredCredential {
  id: string
  contractor_type: string
  credential_type: string
  name: string
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: string
  description: string
  icon: React.ElementType
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-[#62646a]">{title}</CardTitle>
        <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#1dbf73]/10 to-[#1dbf73]/20">
          <Icon className="size-4 text-[#1dbf73]" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-[#404145]">{value}</div>
        <p className="mt-1 text-xs text-[#62646a]">{description}</p>
      </CardContent>
    </Card>
  )
}

export default async function ContractorCredentialsPage() {
  let credentials: CredentialData[] = []
  let requiredCredentials: RequiredCredential[] = []

  if (isDemoMode()) {
    credentials = DEMO_CREDENTIALS as unknown as CredentialData[]
    requiredCredentials = DEMO_REQUIRED_CREDENTIALS as unknown as RequiredCredential[]
  } else {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    // Fetch contractor profile to know their type
    const { data: contractor } = await supabase
      .from('contractor_profiles')
      .select('contractor_type')
      .eq('id', user.id)
      .single()

    // Fetch all credentials
    const { data: credentialsData } = await supabase
      .from('credentials')
      .select('*')
      .eq('contractor_id', user.id)
      .order('created_at', { ascending: false })

    credentials = (credentialsData ?? []) as unknown as CredentialData[]

    // Fetch required credentials for this contractor type
    if (contractor?.contractor_type) {
      const { data: reqData } = await supabase
        .from('required_credentials')
        .select('*')
        .eq('contractor_type', contractor.contractor_type)

      requiredCredentials = (reqData ?? []) as unknown as RequiredCredential[]
    }
  }

  // Group credentials by status
  const verified = credentials.filter((c) => c.status === 'verified')
  const pending = credentials.filter(
    (c) => c.status === 'pending_review' || c.status === 'pending_upload'
  )
  const expired = credentials.filter(
    (c) => c.status === 'expired' || c.status === 'expiring_soon'
  )
  const rejected = credentials.filter((c) => c.status === 'rejected')

  // Check which required credentials are missing
  const existingTypes = new Set(credentials.map((c) => c.credential_type))
  const missingRequired = requiredCredentials.filter(
    (r) => !existingTypes.has(r.credential_type)
  )

  const groups: {
    title: string
    icon: React.ReactNode
    items: CredentialData[]
  }[] = [
    {
      title: 'Verified',
      icon: <ShieldCheck className="size-4 text-[#1dbf73]" />,
      items: verified,
    },
    {
      title: 'Pending Review',
      icon: <Clock className="size-4 text-[#62646a]" />,
      items: pending,
    },
    {
      title: 'Expired / Expiring Soon',
      icon: <AlertTriangle className="size-4 text-destructive" />,
      items: expired,
    },
    {
      title: 'Rejected',
      icon: <FileX className="size-4 text-destructive" />,
      items: rejected,
    },
  ]

  const hasCredentials = credentials.length > 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#404145]">My Credentials</h1>
          <p className="mt-1 text-[#62646a]">
            Manage your professional licenses, certifications, and required documentation.
          </p>
        </div>
        <Button
          className="bg-[#1dbf73] text-white hover:bg-[#19a463]"
          render={<Link href="/contractor/credentials/upload" />}
        >
          <Plus className="size-4" data-icon="inline-start" />
          Upload Credential
        </Button>
      </div>

      {/* Stat strip */}
      {hasCredentials && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Verified"
            value={String(verified.length)}
            description="Credentials approved and active"
            icon={ShieldCheck}
          />
          <StatCard
            title="Pending"
            value={String(pending.length)}
            description="Awaiting upload or review"
            icon={Clock}
          />
          <StatCard
            title="Expired / Expiring"
            value={String(expired.length)}
            description="Need renewal soon"
            icon={AlertTriangle}
          />
          <StatCard
            title="Rejected"
            value={String(rejected.length)}
            description="Action required"
            icon={FileX}
          />
        </div>
      )}

      {/* Required Credentials Checklist */}
      {requiredCredentials.length > 0 && (
        <Card
          className={
            missingRequired.length > 0
              ? 'border-[#bcebd5] bg-[#e8faf1]'
              : undefined
          }
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#404145]">
              <ListChecks className="size-5 text-[#1dbf73]" />
              Required Credentials
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {requiredCredentials.map((req) => {
                const exists = existingTypes.has(req.credential_type)
                return (
                  <li
                    key={req.id}
                    className="flex items-center gap-2 text-sm text-[#111827]"
                  >
                    {exists ? (
                      <ShieldCheck className="size-4 shrink-0 text-[#1dbf73]" />
                    ) : (
                      <AlertTriangle className="size-4 shrink-0 text-[#62646a]" />
                    )}
                    <span className={exists ? '' : 'text-[#62646a]'}>{req.name}</span>
                    {exists ? (
                      <Badge
                        className="ml-auto bg-[#e8faf1] text-[#0f8f56] hover:bg-[#e8faf1]"
                      >
                        Submitted
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="ml-auto">
                        Missing
                      </Badge>
                    )}
                  </li>
                )
              })}
            </ul>
            {missingRequired.length > 0 && (
              <p className="mt-3 text-xs text-[#0f8f56]">
                You have {missingRequired.length} missing required{' '}
                {missingRequired.length === 1 ? 'credential' : 'credentials'}.{' '}
                <Link
                  href="/contractor/credentials/upload"
                  className="text-[#1dbf73] hover:underline"
                >
                  Upload now
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Credentials grouped by status */}
      {groups.map(
        (group) =>
          group.items.length > 0 && (
            <div key={group.title} className="space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-[#404145]">
                {group.icon}
                {group.title}
                <Badge variant="secondary">{group.items.length}</Badge>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {group.items.map((credential) => (
                  <CredentialCard key={credential.id} credential={credential} />
                ))}
              </div>
            </div>
          )
      )}

      {credentials.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#e8faf1]">
              <ShieldCheck className="size-6 text-[#1dbf73]" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-[#404145]">
              No credentials yet
            </h3>
            <p className="mt-1 text-sm text-[#62646a]">
              Upload your first credential to start getting matched with jobs.
            </p>
            <Button
              className="mt-4 bg-[#1dbf73] text-white hover:bg-[#19a463]"
              render={<Link href="/contractor/credentials/upload" />}
            >
              <Plus className="size-4" data-icon="inline-start" />
              Upload your first credential
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
