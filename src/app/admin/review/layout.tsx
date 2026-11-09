import { SectionShell } from '@/components/admin/section-shell'
import { REVIEW_TABS } from '@/lib/admin/sections'

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <SectionShell
      title="Review queue"
      description="Everything waiting on an admin decision, oldest first."
      tabs={REVIEW_TABS}
    >
      {children}
    </SectionShell>
  )
}
