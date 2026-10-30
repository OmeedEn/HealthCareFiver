'use client'

import { useEffect, useState } from 'react'
import { PresenceDot, isOnline, lastSeenLabel } from '@/components/admin/presence-dot'
import { getUserLastSeen } from '../actions'

/** "Online now" / "Last seen 5m ago", refreshed every 30s. */
export function LiveStatus({ userId, initialLastSeen }: { userId: string; initialLastSeen: string | null }) {
  const [lastSeen, setLastSeen] = useState(initialLastSeen)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      try {
        setLastSeen(await getUserLastSeen(userId))
      } catch {
        // keep the last known value
      }
      setNow(Date.now())
    }, 30_000)
    return () => clearInterval(id)
  }, [userId])

  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <PresenceDot lastSeenAt={lastSeen} now={now} />
      <span className={isOnline(lastSeen, now) ? 'font-medium text-[#0f8f56]' : 'text-[#9ca3af]'}>
        {lastSeenLabel(lastSeen, now)}
      </span>
    </span>
  )
}
