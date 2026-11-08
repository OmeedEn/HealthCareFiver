import { SectionShell } from '@/components/admin/section-shell'
import { INBOX_TABS } from '@/lib/admin/sections'

export default function InboxLayout({ children }: { children: React.ReactNode }) {
  return (
    <SectionShell
      title="Inbox"
      description="What people sent the team: support threads, care requests, bug reports and disputes."
      tabs={INBOX_TABS}
    >
      {children}
    </SectionShell>
  )
}
