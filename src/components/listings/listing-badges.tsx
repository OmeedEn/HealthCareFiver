import { ShieldAlert } from 'lucide-react'
import type { ListingStatus } from '@/lib/listings/offering'

const STATUS: Record<ListingStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-[#eeebe4] text-[#1a1a17]' },
  pending_review: { label: 'In review', className: 'bg-[#fbf0dc] text-[#8a5a00]' },
  published: { label: 'Published', className: 'bg-[#eceefe] text-[#2330c8]' },
  rejected: { label: 'Changes requested', className: 'bg-[#fdecea] text-[#b42318]' },
  paused: { label: 'Paused', className: 'bg-[#eceefe] text-[#2330c8]' },
}

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  const s = STATUS[status] ?? STATUS.draft
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.className}`}
    >
      {s.label}
    </span>
  )
}

export function NeedsMalpracticeTag() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-[#ecd3a3] bg-[#fbf0dc] px-2.5 py-0.5 text-xs font-medium text-[#8a5a00]"
      title="Goes live only after your malpractice certificate is reviewed"
    >
      <ShieldAlert className="size-3" aria-hidden="true" />
      Needs malpractice
    </span>
  )
}
