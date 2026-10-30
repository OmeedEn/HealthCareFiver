import { cn } from '@/lib/utils'

/** Keep in sync with ONLINE_WINDOW_MS in src/lib/admin/support.ts. */
const ONLINE_WINDOW_MS = 150_000

export function isOnline(lastSeenAt: string | null | undefined, now = Date.now()): boolean {
  return !!lastSeenAt && now - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS
}

export function lastSeenLabel(lastSeenAt: string | null | undefined, now = Date.now()): string {
  if (!lastSeenAt) return 'Not seen yet'
  if (isOnline(lastSeenAt, now)) return 'Online now'
  const mins = Math.floor((now - new Date(lastSeenAt).getTime()) / 60_000)
  if (mins < 60) return `Last seen ${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Last seen ${hours}h ago`
  const days = Math.floor(hours / 24)
  return `Last seen ${days}d ago`
}

/** Green dot when online, hollow gray otherwise. Title shows last seen. */
export function PresenceDot({
  lastSeenAt,
  now,
  className,
}: {
  lastSeenAt: string | null | undefined
  now?: number
  className?: string
}) {
  const online = isOnline(lastSeenAt, now)
  const label = lastSeenLabel(lastSeenAt, now)
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        'inline-block size-2.5 shrink-0 rounded-full',
        online ? 'bg-[#1dbf73] ring-2 ring-[#1dbf73]/25' : 'border border-[#c5c6c9] bg-white',
        className
      )}
    />
  )
}

export function ReplyStateBadge({ needsReply, awaitingUser }: { needsReply: boolean; awaitingUser: boolean }) {
  if (needsReply) {
    return (
      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
        Needs reply
      </span>
    )
  }
  if (awaitingUser) {
    return (
      <span className="shrink-0 rounded-full bg-[#f1f3f5] px-2 py-0.5 text-[11px] font-medium text-[#62646a]">
        Waiting on them
      </span>
    )
  }
  return null
}
