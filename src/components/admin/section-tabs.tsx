'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export interface SectionTab {
  href: string
  label: string
  count?: number
}

/** Sub-navigation for an admin section (Review, Inbox). Active = longest matching href. */
export function SectionTabs({ tabs }: { tabs: SectionTab[] }) {
  const pathname = usePathname()
  const active = tabs
    .filter((t) => pathname === t.href || pathname.startsWith(t.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  return (
    <div className="-mx-1 overflow-x-auto">
      <div className="inline-flex min-w-max gap-1 rounded-lg border border-[#e4e5e7] bg-white p-1">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm',
              active === t.href
                ? 'bg-[#e8faf1] font-semibold text-[#0f8f56]'
                : 'text-[#62646a] hover:text-[#1dbf73]'
            )}
          >
            {t.label}
            {!!t.count && (
              <span className="rounded-full bg-[#1dbf73] px-1.5 text-[11px] font-semibold leading-[18px] text-white">
                {t.count}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
