import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// The org queue lives under Verification; keep old links working.
export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const params = new URLSearchParams({ tab: 'organizations' })
  if (status) params.set('status', status)
  redirect(`/admin/verification?${params}`)
}
