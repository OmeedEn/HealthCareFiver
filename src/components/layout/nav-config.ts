/**
 * Navigation config shared by the top nav (every page) and the Account area.
 *
 * The app is split in two on purpose:
 * - Explore (top nav, public links): find a professional, events, who Sanus
 *   is for. Same for signed-in and signed-out visitors.
 * - Mine (avatar menu → Account): bookings, messages, the professional's or
 *   organization's own business pages, settings.
 */
import {
  LayoutDashboard,
  Briefcase,
  ShieldCheck,
  FileText,
  CreditCard,
  MessageSquare,
  Settings,
  PlusCircle,
  Search,
  Users,
  Bell,
  Store,
  Megaphone,
  Siren,
  CalendarCheck,
  CalendarClock,
  Landmark,
  Inbox,
  BadgeDollarSign,
} from 'lucide-react'
import { STAFFING_POSTS_ENABLED } from '@/lib/onboarding/organization'

export type NavRole = 'contractor' | 'facility' | 'admin' | 'client'

export type NavItem = {
  label: string
  href: string
  icon: React.ElementType
}

export type NavGroup = {
  /** Short group heading (shown in the mobile menu; desktop tabs use a divider). */
  label: string
  items: NavItem[]
}

/** Public "explore" links, the same for everyone. */
export const PUBLIC_NAV = [
  { label: 'Find a professional', href: '/find-care' },
  { label: 'Events & training', href: '/events-and-training' },
  { label: 'For organizations', href: '/for-organizations' },
  { label: 'For professionals', href: '/for-professionals' },
] as const

/** Map a profiles.role value (incl. staffing_agency) to a nav role. */
export function toNavRole(role: string | null | undefined): NavRole {
  if (role === 'facility' || role === 'staffing_agency') return 'facility'
  if (role === 'admin') return 'admin'
  if (role === 'client') return 'client'
  return 'contractor'
}

const YOU_GROUP: NavGroup = {
  label: 'You',
  items: [
    { label: 'My bookings', href: '/bookings', icon: CalendarCheck },
    { label: 'Messages', href: '/messages', icon: MessageSquare },
    { label: 'Notifications', href: '/notifications', icon: Bell },
    { label: 'Settings', href: '/settings', icon: Settings },
  ],
}

const CONTRACTOR_ACCOUNT_NAV: NavGroup[] = [
  {
    label: 'Your practice',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Listings', href: '/contractor/listings', icon: Store },
      { label: 'Inquiries', href: '/contractor/inquiries', icon: Inbox },
      // Spec staffing posts stay off until the legal review.
      ...(STAFFING_POSTS_ENABLED
        ? [{ label: 'Jobs', href: '/contractor/jobs', icon: Briefcase }]
        : []),
      { label: 'Rates', href: '/contractor/rates', icon: BadgeDollarSign },
      { label: 'Availability', href: '/contractor/availability', icon: CalendarClock },
    ],
  },
  {
    label: 'Business',
    items: [
      { label: 'Credentials', href: '/contractor/credentials', icon: ShieldCheck },
      { label: 'Contracts', href: '/contractor/contracts', icon: FileText },
      { label: 'Payments', href: '/contractor/payments', icon: CreditCard },
    ],
  },
  YOU_GROUP,
]

const FACILITY_ACCOUNT_NAV: NavGroup[] = [
  {
    label: 'Your organization',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'My Jobs', href: '/facility/jobs', icon: Briefcase },
      { label: 'Services & Events', href: '/facility/listings', icon: Megaphone },
      { label: 'Bookings', href: '/facility/bookings', icon: CalendarCheck },
      ...(STAFFING_POSTS_ENABLED
        ? [
            { label: 'Post a Job', href: '/facility/jobs/new', icon: PlusCircle },
            { label: 'Post an Urgent Need', href: '/facility/needs/new', icon: Siren },
          ]
        : []),
      { label: 'Find Contractors', href: '/facility/contractors', icon: Search },
    ],
  },
  {
    label: 'Business',
    items: [
      { label: 'Contracts', href: '/facility/contracts', icon: FileText },
      { label: 'Payments', href: '/facility/payments', icon: CreditCard },
      { label: 'Payouts', href: '/facility/payouts', icon: Landmark },
    ],
  },
  {
    label: 'You',
    items: [
      { label: 'Messages', href: '/messages', icon: MessageSquare },
      { label: 'Notifications', href: '/notifications', icon: Bell },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
]

// Admin pages have their own nav in src/app/admin/layout.tsx; this is what an
// admin sees on the shared account pages (/settings, /notifications, …).
const ADMIN_ACCOUNT_NAV: NavGroup[] = [
  {
    label: 'Admin',
    items: [
      { label: 'Admin Console', href: '/admin', icon: LayoutDashboard },
      { label: 'Review', href: '/admin/review', icon: ShieldCheck },
      { label: 'People', href: '/admin/people', icon: Users },
      { label: 'Inbox', href: '/admin/inbox', icon: MessageSquare },
    ],
  },
  {
    label: 'You',
    items: [
      { label: 'Notifications', href: '/notifications', icon: Bell },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
]

// Clients (consumers seeking care): finding care lives in the top nav; the
// account area is only their own stuff. Never the contractor nav, which leads
// to the provider paywall.
const CLIENT_ACCOUNT_NAV: NavGroup[] = [
  {
    label: 'You',
    items: [
      { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
      ...YOU_GROUP.items,
    ],
  },
]

export function accountNavFor(role: NavRole): NavGroup[] {
  switch (role) {
    case 'facility':
      return FACILITY_ACCOUNT_NAV
    case 'admin':
      return ADMIN_ACCOUNT_NAV
    case 'client':
      return CLIENT_ACCOUNT_NAV
    default:
      return CONTRACTOR_ACCOUNT_NAV
  }
}

/** Where "Account" in the avatar menu goes. */
export function accountHomeFor(role: NavRole): string {
  return role === 'admin' ? '/admin' : '/dashboard'
}

/** The signed-in user's own profile page. */
export function profileHrefFor(role: string | null | undefined): string {
  if (role === 'contractor') return '/contractor/profile'
  if (role === 'facility' || role === 'staffing_agency') return '/facility/profile'
  return '/settings'
}

export type MenuLink = { label: string; href: string; icon: React.ElementType }

/** Avatar menu links (Sign out is added by the menu itself). */
export function userMenuFor(role: NavRole, userId?: string | null): MenuLink[][] {
  const mine: MenuLink[] = [
    { label: 'Account', href: accountHomeFor(role), icon: LayoutDashboard },
  ]
  if (role !== 'admin') {
    mine.push({
      label: 'My bookings',
      href: role === 'facility' ? '/facility/bookings' : '/bookings',
      icon: CalendarCheck,
    })
  }
  mine.push({ label: 'Messages', href: '/messages', icon: MessageSquare })

  const profile: MenuLink[] = []
  if (role === 'contractor') {
    profile.push({ label: 'Edit profile', href: '/contractor/profile/edit', icon: Users })
    profile.push({
      label: 'View public profile',
      href: userId ? `/pros/${userId}` : '/contractor/profile',
      icon: Search,
    })
  } else if (role === 'facility') {
    profile.push({ label: 'Organization profile', href: '/facility/profile', icon: Users })
  } else if (role === 'admin') {
    profile.push({ label: 'Admin console', href: '/admin', icon: ShieldCheck })
  }

  const settings: MenuLink[] = [{ label: 'Settings', href: '/settings', icon: Settings }]

  return [mine, profile, settings].filter((g) => g.length > 0)
}

/** Longest-prefix match so /contractor/listings/new highlights Listings. */
export function activeHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null
  for (const href of hrefs) {
    if (pathname === href || pathname.startsWith(href + '/')) {
      if (!best || href.length > best.length) best = href
    }
  }
  return best
}
