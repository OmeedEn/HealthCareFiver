import { redirectToBusiestTab } from '@/components/admin/section-shell'
import { INBOX_TABS } from '@/lib/admin/sections'

export const dynamic = 'force-dynamic'

export default async function InboxIndexPage() {
  return redirectToBusiestTab(INBOX_TABS)
}
