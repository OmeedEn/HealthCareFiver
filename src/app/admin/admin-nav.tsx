'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * The five admin areas. Detail pages live at stable URLs outside their
 * section (e.g. /admin/verification/[id] is a Review page), so `also` lists
 * the extra prefixes that should light up each item.
 */
export const ADMIN_SECTIONS = [
  { href: '/admin', label: 'Overview', also: [] as string[] },
  { href: '/admin/review', label: 'Review', also: ['/admin/verification', '/admin/organizations'] },
  { href: '/admin/people', label: 'People', also: ['/admin/users'] },
  { href: '/admin/inbox', label: 'Inbox', also: ['/admin/messages'] },
  { href: '/admin/activity', label: 'Activity', also: [] as string[] },
] as const

const under = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(prefix + '/')

function isActive(pathname: string, item: (typeof ADMIN_SECTIONS)[number]) {
  if (item.href === '/admin') return pathname === '/admin'
  return under(pathname, item.href) || item.also.some((p) => under(pathname, p))
}

export function Count({ n }: { n?: number }) {
  if (!n) return null
  return (
    <span className="rounded-full bg-[#2f3cf5] px-1.5 text-[11px] font-semibold leading-[18px] text-white">
      {n}
    </span>
  )
}

export function AdminNav({ badges }: { badges: Record<string, number> }) {
  const pathname = usePathname()
  return (
    <nav className="flex flex-wrap items-center gap-5 text-sm">
      {ADMIN_SECTIONS.map((item) => {
        const active = isActive(pathname, item)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex items-center gap-1.5 border-b-2 py-1 ${
              active
                ? 'border-[#2f3cf5] font-semibold text-[#1a1a17]'
                : 'border-transparent text-[#5f5d57] hover:text-[#2f3cf5]'
            }`}
          >
            {item.label}
            <Count n={badges[item.href]} />
          </Link>
        )
      })}
    </nav>
  )
}
