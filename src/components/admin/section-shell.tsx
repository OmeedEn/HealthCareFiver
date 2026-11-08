import { redirect } from 'next/navigation'
import { isDemoMode } from '@/lib/demo/data'
import { requireAdmin } from '@/lib/admin/guard'
import { getQueueCounts, type QueueCounts } from '@/lib/admin/queue-counts'
import type { SectionTabDef } from '@/lib/admin/sections'
import { SectionTabs } from './section-tabs'

/** Section header (title + tab bar with waiting counts) shared by Review and Inbox. */
export async function SectionShell({
  title,
  description,
  tabs,
  children,
}: {
  title: string
  description?: string
  tabs: SectionTabDef[]
  children: React.ReactNode
}) {
  let counts: QueueCounts | null = null
  if (!isDemoMode()) {
    await requireAdmin()
    counts = await getQueueCounts()
  }
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a17]">{title}</h1>
          {description && <p className="mt-1 text-sm text-[#5f5d57]">{description}</p>}
        </div>
        <SectionTabs tabs={tabs.map((t) => ({ href: t.href, label: t.label, count: counts?.[t.key] }))} />
      </div>
      {children}
    </div>
  )
}

/** Section index: open the first tab with something waiting (the first tab when all clear). */
export async function redirectToBusiestTab(tabs: SectionTabDef[]): Promise<never> {
  if (isDemoMode()) redirect(tabs[0].href)
  await requireAdmin()
  const counts = await getQueueCounts()
  redirect((tabs.find((t) => counts[t.key] > 0) ?? tabs[0]).href)
}
