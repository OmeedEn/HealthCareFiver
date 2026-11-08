import { isDemoMode } from '@/lib/demo/data'
import { AdminDemoNotice } from '@/components/admin/demo-notice'
import { OrgQueue } from './org-queue'

export const dynamic = 'force-dynamic'

export default async function AdminOrganizationsQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  if (isDemoMode()) return <AdminDemoNotice />
  const { status } = await searchParams
  return (
    <OrgQueue
      status={status}
      hrefFor={(f) => `/admin/review/organizations${f ? `?status=${f}` : ''}`}
    />
  )
}
