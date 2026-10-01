import { ShieldAlert } from 'lucide-react'
import type { ListingStatus } from '@/lib/listings/offering'

const STATUS: Record<ListingStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-[#f1f3f5] text-[#404145]' },
  pending_review: { label: 'In review', className: 'bg-[#fdf6e3] text-[#8a6508]' },
  published: { label: 'Published', className: 'bg-[#e8faf1] text-[#0f8f56]' },
  rejected: { label: 'Changes requested', className: 'bg-[#fdecea] text-[#c0392b]' },
  paused: { label: 'Paused', className: 'bg-[#eef2ff] text-[#3f4bb5]' },
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
      className="inline-flex items-center gap-1 rounded-full border border-[#f5deb3] bg-[#fffaf0] px-2.5 py-0.5 text-xs font-medium text-[#8a6508]"
      title="Goes live only after your malpractice certificate is reviewed"
    >
      <ShieldAlert className="size-3" aria-hidden="true" />
      Needs malpractice
    </span>
  )
}
