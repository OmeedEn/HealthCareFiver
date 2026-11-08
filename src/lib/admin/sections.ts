import type { QueueCounts } from '@/lib/admin/queue-counts'

export interface SectionTabDef {
  href: string
  label: string
  key: keyof QueueCounts
}

/** Review queue tabs: everything waiting on an admin decision. */
export const REVIEW_TABS: SectionTabDef[] = [
  { href: '/admin/review/professionals', label: 'Professionals', key: 'professionals' },
  { href: '/admin/review/organizations', label: 'Organizations', key: 'organizations' },
  { href: '/admin/review/documents', label: 'Documents', key: 'documents' },
  { href: '/admin/review/signups', label: 'Unsure signups', key: 'signups' },
  { href: '/admin/review/listings', label: 'Pro listings', key: 'listings' },
  { href: '/admin/review/org-listings', label: 'Org listings', key: 'orgListings' },
]

/** Inbox tabs: things people sent the team. */
export const INBOX_TABS: SectionTabDef[] = [
  { href: '/admin/inbox/messages', label: 'Support messages', key: 'messages' },
  { href: '/admin/inbox/care-requests', label: 'Care requests', key: 'careRequests' },
  { href: '/admin/inbox/bugs', label: 'Bug reports', key: 'bugs' },
  { href: '/admin/inbox/disputes', label: 'Disputes', key: 'disputes' },
]
