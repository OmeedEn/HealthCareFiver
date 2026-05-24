import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { CredentialCard } from '@/components/contractor/credential-card'
import type { CredentialData } from '@/components/contractor/credential-card'
import { CREDENTIAL_TYPE_LABELS } from '@/lib/utils/constants'
import { Plus, ShieldCheck, Clock, AlertTriangle, FileX } from 'lucide-react'

interface RequiredCredential {
  id: string
  contractor_type: string
  credential_type: string
  name: string
}

export default async function ContractorCredentialsPage() {
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

  const credentials = (credentialsData ?? []) as unknown as CredentialData[]

  // Fetch required credentials for this contractor type
  let requiredCredentials: RequiredCredential[] = []
  if (contractor?.contractor_type) {
    const { data: reqData } = await supabase
      .from('required_credentials')
      .select('*')
      .eq('contractor_type', contractor.contractor_type)

    requiredCredentials = (reqData ?? []) as unknown as RequiredCredential[]
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

  const groups = [
    {
      title: 'Verified',
      icon: <ShieldCheck className="size-4 text-green-600" />,
      items: verified,
    },
    {
      title: 'Pending Review',
      icon: <Clock className="size-4 text-yellow-600" />,
      items: pending,
    },
    {
      title: 'Expired / Expiring Soon',
      icon: <AlertTriangle className="size-4 text-red-600" />,
      items: expired,
    },
    {
      title: 'Rejected',
      icon: <FileX className="size-4 text-red-600" />,
      items: rejected,
    },
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Credentials</h1>
        <Button render={<Link href="/contractor/credentials/upload" />}>
          <Plus className="size-4" data-icon="inline-start" />
          Upload Credential
        </Button>
      </div>

      {/* Required Credentials Checklist */}
      {requiredCredentials.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Required Credentials</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {requiredCredentials.map((req) => {
                const exists = existingTypes.has(req.credential_type)
                return (
                  <li key={req.id} className="flex items-center gap-2 text-sm">
                    {exists ? (
                      <ShieldCheck className="size-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="size-4 text-yellow-600" />
                    )}
                    <span className={exists ? '' : 'text-muted-foreground'}>
                      {req.name}
                    </span>
                    {exists ? (
                      <Badge variant="default" className="ml-auto">
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
              <p className="mt-3 text-xs text-muted-foreground">
                You have {missingRequired.length} missing required{' '}
                {missingRequired.length === 1 ? 'credential' : 'credentials'}.{' '}
                <Link
                  href="/contractor/credentials/upload"
                  className="text-primary hover:underline"
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
              <h2 className="flex items-center gap-2 text-lg font-semibold">
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
            <FileX className="mx-auto size-10 text-muted-foreground" />
            <h3 className="mt-4 font-medium">No credentials yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload your first credential to get started.
            </p>
            <Button className="mt-4" render={<Link href="/contractor/credentials/upload" />}>
              <Plus className="size-4" data-icon="inline-start" />
              Upload Credential
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
