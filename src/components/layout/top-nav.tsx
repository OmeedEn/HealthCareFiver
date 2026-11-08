'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ReportBugButton } from '@/components/bugs/report-bug-button'
import { NotificationsBell } from './notifications-bell'
import { MessagesLink } from './messages-link'
import { UserAvatar, UserMenu, useSignOut } from './user-menu'
import { PUBLIC_NAV, accountNavFor, activeHref, userMenuFor } from './nav-config'
import { useSessionUser, type SessionUser } from './use-session-user'

export function SanusLogo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Sanus home">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2f3cf5] text-base font-bold text-white">
        S
      </div>
      <span className="text-2xl font-bold tracking-tight text-[#1a1a17]">
        Sanus<span className="text-[#2f3cf5]">.</span>
      </span>
    </Link>
  )
}

/** Messages, notifications and the avatar menu for a signed-in user. */
export function SignedInActions({
  user,
  showReportBug = false,
}: {
  user: SessionUser
  showReportBug?: boolean
}) {
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {showReportBug && (
        <span className="hidden sm:inline-flex">
          <ReportBugButton />
        </span>
      )}
      <MessagesLink />
      <NotificationsBell />
      <UserMenu user={user} />
    </div>
  )
}

function SignedOutActions() {
  return (
    <>
      <Link
        href="/login"
        className="hidden text-sm font-medium text-[#5f5d57] transition hover:text-[#1a1a17] sm:block"
      >
        Sign in
      </Link>
      <Link
        href="/signup"
        className="inline-flex h-10 items-center justify-center rounded-lg bg-[#2f3cf5] px-5 text-sm font-semibold text-white transition hover:bg-[#2330c8]"
      >
        Join Sanus
      </Link>
    </>
  )
}

function MobileMenu({
  open,
  onOpenChange,
  user,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: SessionUser | null
}) {
  const pathname = usePathname()
  const signOut = useSignOut()
  const close = () => onOpenChange(false)
  const accountGroups = user ? accountNavFor(user.role) : []
  const accountActive = activeHref(
    pathname,
    accountGroups.flatMap((g) => g.items.map((i) => i.href))
  )
  // Profile links from the avatar menu that the account tabs don't cover.
  const extraLinks = user
    ? userMenuFor(user.role, user.id)
        .flat()
        .filter(
          (l) =>
            l.label !== 'Account' &&
            !accountGroups.some((g) => g.items.some((i) => i.href === l.href))
        )
    : []

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
      active ? 'bg-[#f4f5fe] font-semibold text-[#2f3cf5]' : 'text-[#3a3934] hover:bg-[#eeebe4]'
    }`

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" showCloseButton className="w-80 gap-0 overflow-y-auto p-0">
        <SheetHeader className="border-b border-[#e3dfd6] px-4 py-4">
          <SheetTitle className="text-left">Menu</SheetTitle>
        </SheetHeader>

        <nav aria-label="Explore" className="px-3 py-3">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-[#706d65]">
            Explore
          </p>
          {PUBLIC_NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href} onClick={close} className={linkClass(active)}>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {user ? (
          <>
            <div className="flex items-center gap-3 border-t border-[#e3dfd6] px-6 py-4">
              <UserAvatar user={user} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#1a1a17]">{user.name}</p>
                {user.email && <p className="truncate text-xs text-[#5f5d57]">{user.email}</p>}
              </div>
            </div>
            {accountGroups.map((group) => (
              <nav key={group.label} aria-label={group.label} className="px-3 pb-3">
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-[#706d65]">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={close}
                      className={linkClass(accountActive === item.href)}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            ))}
            {extraLinks.length > 0 && (
              <nav aria-label="Profile" className="px-3 pb-3">
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-[#706d65]">
                  Profile
                </p>
                {extraLinks.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link key={item.href} href={item.href} onClick={close} className={linkClass(false)}>
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            )}
            <div className="border-t border-[#e3dfd6] px-3 py-3">
              <button
                type="button"
                onClick={() => {
                  close()
                  signOut()
                }}
                className={`${linkClass(false)} w-full`}
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2 border-t border-[#e3dfd6] px-6 py-4">
            <Link
              href="/signup"
              onClick={close}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#2f3cf5] px-5 text-sm font-semibold text-white hover:bg-[#2330c8]"
            >
              Join Sanus
            </Link>
            <Link
              href="/login"
              onClick={close}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[#e3dfd6] px-5 text-sm font-semibold text-[#3a3934] hover:bg-[#eeebe4]"
            >
              Sign in
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

/**
 * The one top navigation for the whole site — marketing pages and the
 * signed-in app alike. Left: logo + public "explore" links. Right: sign in /
 * join, or messages, notifications and the avatar menu (→ Account).
 *
 * Pass `user` when the server already knows who's signed in (the app
 * layout); otherwise the session is read in the browser.
 */
export function TopNav({
  user: initialUser,
  inApp = false,
}: {
  user?: SessionUser | null
  /** In the signed-in app: also shows the Report a bug button. */
  inApp?: boolean
}) {
  const pathname = usePathname()
  const session = useSessionUser(initialUser)
  const [open, setOpen] = useState(false)
  const user = typeof session === 'object' ? session : null

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <header className="sticky top-0 z-40 border-b border-[#e3dfd6] bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[90rem] items-center justify-between gap-4 px-4 sm:px-6 lg:h-20">
        <SanusLogo />

        <nav
          aria-label="Main"
          className="hidden items-center gap-7 text-sm font-medium text-[#5f5d57] lg:flex"
        >
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={
                isActive(item.href)
                  ? 'font-semibold text-[#2f3cf5]'
                  : 'transition hover:text-[#1a1a17]'
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {session === 'loading' ? (
            // Hold the space while the session loads so the nav doesn't jump.
            <div aria-hidden className="invisible flex items-center gap-3">
              <SignedOutActions />
            </div>
          ) : user ? (
            <SignedInActions user={user} showReportBug={inApp} />
          ) : (
            <SignedOutActions />
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-label="Open menu"
            className="rounded-md p-1.5 text-[#3a3934] hover:bg-[#eeebe4] lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
      <MobileMenu open={open} onOpenChange={setOpen} user={user} />
    </header>
  )
}
