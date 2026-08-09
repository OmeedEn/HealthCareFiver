'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatRelativeTime } from '@/lib/utils/format'
import { Loader2 } from 'lucide-react'

interface QueuedProvider {
  id: string
  first_name: string
  last_name: string
  contractor_type: string
  verification_status: string
  updated_at: string
  profiles: { email: string | null } | null
}

const STATUS_BADGE: Record<string, 'secondary' | 'outline' | 'destructive'> = {
  pending_review: 'secondary',
  more_info_requested: 'outline',
  rejected: 'destructive',
}

const STATUS_LABEL: Record<string, string> = {
  pending_review: 'Pending Review',
  more_info_requested: 'More Info Requested',
}

export default function AdminVerificationQueuePage() {
  const [providers, setProviders] = useState<QueuedProvider[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function fetchProviders() {
      const { data } = await supabase
        .from('contractor_profiles')
        .select(
          'id, first_name, last_name, contractor_type, verification_status, updated_at, profiles(email)'
        )
        .in('verification_status', ['pending_review', 'more_info_requested'])
        .order('updated_at', { ascending: true })

      setProviders((data ?? []) as unknown as QueuedProvider[])
      setLoading(false)
    }

    fetchProviders()
  }, [])

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
        <h1 className="text-2xl font-bold">Provider Verification Queue</h1>
        <Badge variant="secondary">{providers.length} awaiting review</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Providers</CardTitle>
        </CardHeader>
        <CardContent>
          {providers.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No providers awaiting verification.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/verification/${provider.id}`}
                        className="hover:underline"
                      >
                        {provider.first_name} {provider.last_name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{provider.contractor_type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {provider.profiles?.email ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[provider.verification_status] ?? 'secondary'}>
                        {STATUS_LABEL[provider.verification_status] ?? provider.verification_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatRelativeTime(provider.updated_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
