'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// The day-to-day admin jobs: verify people, talk to them, check their documents.
const PRIMARY = [
  { href: '/admin/verification', label: 'Verification' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/credentials', label: 'Credentials & documents' },
  { href: '/messages', label: 'Messages' },
]

// Everything else stays reachable, just tucked away.
const MORE = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/classification', label: 'Needs classification' },
  { href: '/admin/organizations', label: 'Organizations' },
  { href: '/admin/care-requests', label: 'Care requests' },
  { href: '/admin/listings', label: 'Listings review' },
  { href: '/admin/org-listings', label: 'Org listings' },
  { href: '/admin/disputes', label: 'Disputes' },
  { href: '/admin/activity', label: 'Activity' },
  { href: '/admin/bugs', label: 'Bugs' },
]

function isActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(href + '/')
}

function Count({ n }: { n?: number }) {
  if (!n) return null
  return (
    <span className="rounded-full bg-[#1dbf73] px-1.5 text-[11px] font-semibold leading-[18px] text-white">
      {n}
    </span>
  )
}

export function AdminNav({ badges }: { badges: Record<string, number> }) {
  const pathname = usePathname()
  const router = useRouter()
  const moreActive = MORE.some((m) => isActive(pathname, m.href))
  const moreBadge = MORE.reduce((sum, m) => sum + (badges[m.href] ?? 0), 0)

  const linkClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 border-b-2 py-1 ${
      active
        ? 'border-[#1dbf73] font-semibold text-[#404145]'
        : 'border-transparent text-[#62646a] hover:text-[#1dbf73]'
    }`

  return (
    <nav className="flex flex-wrap items-center gap-5 text-sm">
      {PRIMARY.map((item) => (
        <Link key={item.href} href={item.href} className={linkClass(isActive(pathname, item.href))}>
          {item.label}
          <Count n={badges[item.href]} />
        </Link>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger className={`${linkClass(moreActive)} cursor-pointer`}>
          More
          <Count n={moreBadge} />
          <ChevronDown className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6}>
          {MORE.map((item) => (
            <DropdownMenuItem key={item.href} onClick={() => router.push(item.href)}>
              <span className="flex w-full items-center justify-between gap-3">
                {item.label}
                <Count n={badges[item.href]} />
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  )
}
