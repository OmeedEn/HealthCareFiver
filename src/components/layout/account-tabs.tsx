'use client'

import { Fragment, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { accountNavFor, activeHref, type NavRole } from './nav-config'

/**
 * The Account area's sub-nav: a horizontal, scrollable row of tabs, grouped
 * (e.g. practice · business · you) with dividers between groups. Replaces the
 * old left sidebar.
 */
export function AccountTabs({ role }: { role: NavRole }) {
  const pathname = usePathname()
  const groups = accountNavFor(role)
  const current = activeHref(
    pathname,
    groups.flatMap((g) => g.items.map((i) => i.href))
  )
  const activeRef = useRef<HTMLAnchorElement>(null)

  // Keep the active tab visible on narrow screens.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [current])

  return (
    <div className="border-b border-[#e5e7eb] bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 sm:px-6">
        <span className="hidden shrink-0 text-sm font-bold text-[#111827] md:block">Account</span>
        <nav
          aria-label="Account"
          className="-mb-px flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {groups.map((group, gi) => (
            <Fragment key={group.label}>
              {gi > 0 && (
                <span aria-hidden className="mx-2 h-5 w-px shrink-0 bg-[#e5e7eb]" />
              )}
              <div role="group" aria-label={group.label} className="flex shrink-0 items-center gap-1">
                {group.items.map((item) => {
                  const active = current === item.href
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      ref={active ? activeRef : undefined}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 py-3 text-sm font-medium transition-colors ${
                        active
                          ? 'border-[#1dbf73] text-[#0f8f56]'
                          : 'border-transparent text-[#62646a] hover:text-[#404145]'
                      }`}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </Fragment>
          ))}
        </nav>
      </div>
    </div>
  )
}
