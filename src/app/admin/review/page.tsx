import { redirectToBusiestTab } from '@/components/admin/section-shell'
import { REVIEW_TABS } from '@/lib/admin/sections'

export const dynamic = 'force-dynamic'

export default async function ReviewIndexPage() {
  return redirectToBusiestTab(REVIEW_TABS)
}
