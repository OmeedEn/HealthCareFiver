'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { NavAuth } from '@/components/marketing/nav-auth'

export const MARKETING_NAV = [
  { label: 'Find a professional', href: '/find-care' },
  { label: 'Events & training', href: '/events-and-training' },
  { label: 'For organizations', href: '/for-organizations' },
  { label: 'For professionals', href: '/for-professionals' },
  { label: 'How it works', href: '/how-it-works' },
]

/** Public marketing header shared by the homepage and every marketing page. */
export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <header className="sticky top-0 z-50 border-b border-[#e5e7eb] bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1dbf73] text-base font-bold text-white">
            S
          </div>
          <span className="text-2xl font-bold tracking-tight text-[#111827]">
            Sanus<span className="text-[#1dbf73]">.</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-[#6b7280] lg:flex">
          {MARKETING_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={
                isActive(item.href)
                  ? 'font-semibold text-[#1dbf73]'
                  : 'transition hover:text-[#111827]'
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <NavAuth>
            <Link
              href="/login"
              className="hidden text-sm font-medium text-[#6b7280] transition hover:text-[#111827] sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1dbf73] px-5 text-sm font-semibold text-white transition hover:bg-[#19a463]"
            >
              Join Sanus
            </Link>
          </NavAuth>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="rounded-md p-1.5 text-[#374151] hover:bg-[#f3f4f6] lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[#e5e7eb] bg-white px-4 py-3 lg:hidden">
          <nav className="flex flex-col gap-1 text-sm font-medium">
            {MARKETING_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2 ${
                  isActive(item.href)
                    ? 'bg-[#f0faf5] font-semibold text-[#1dbf73]'
                    : 'text-[#6b7280] hover:text-[#111827]'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <NavAuth hideWhenSignedIn>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-[#6b7280] hover:text-[#111827] sm:hidden"
              >
                Sign in
              </Link>
            </NavAuth>
          </nav>
        </div>
      )}
    </header>
  )
}
