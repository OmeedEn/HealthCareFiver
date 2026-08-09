'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/data'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { toast } from 'sonner'
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
  AlertTriangle,
  LogOut,
  Crown,
  GraduationCap,
} from 'lucide-react'

type NavItem = {
  label: string
  href: string
  icon: React.ElementType
}

const CONTRACTOR_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Jobs', href: '/contractor/jobs', icon: Briefcase },
  { label: 'My Credentials', href: '/contractor/credentials', icon: ShieldCheck },
  { label: 'Contracts', href: '/contractor/contracts', icon: FileText },
  { label: 'Payments', href: '/contractor/payments', icon: CreditCard },
  { label: 'Messages', href: '/messages', icon: MessageSquare },
  { label: 'Events', href: '/events', icon: GraduationCap },
  { label: 'Membership', href: '/membership', icon: Crown },
  { label: 'Settings', href: '/settings', icon: Settings },
]

const FACILITY_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Post a Job', href: '/facility/jobs/new', icon: PlusCircle },
  { label: 'My Jobs', href: '/facility/jobs', icon: Briefcase },
  { label: 'Find Contractors', href: '/facility/contractors', icon: Search },
  { label: 'Contracts', href: '/facility/contracts', icon: FileText },
  { label: 'Payments', href: '/facility/payments', icon: CreditCard },
  { label: 'Messages', href: '/messages', icon: MessageSquare },
  { label: 'Events', href: '/events', icon: GraduationCap },
  { label: 'Settings', href: '/settings', icon: Settings },
]

// Admin nav matches what exists under src/app/admin today. Jobs/Payments/Reports
// items previously listed here had no backing routes — removed rather than left
// as 404s. Add them back when the corresponding admin pages ship.
const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Credentials', href: '/admin/credentials', icon: ShieldCheck },
  { label: 'Disputes', href: '/admin/disputes', icon: AlertTriangle },
  { label: 'Events', href: '/events', icon: GraduationCap },
  { label: 'Settings', href: '/settings', icon: Settings },
]

function getNavItems(role: string): NavItem[] {
  switch (role) {
    case 'facility':
      return FACILITY_NAV
    case 'admin':
      return ADMIN_NAV
    default:
      return CONTRACTOR_NAV
  }
}

function NavLinks({
  items,
  pathname,
  onClick,
}: {
  items: NavItem[]
  pathname: string
  onClick?: () => void
}) {
  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {items.map((item) => {
        const isActive = pathname === item.href
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClick}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-[#e8faf1] text-[#1dbf73]'
                : 'text-[#62646a] hover:bg-[#f5f5f5] hover:text-[#404145]'
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

interface SidebarProps {
  role: 'contractor' | 'facility' | 'admin'
  userName: string
  userEmail: string
  variant: 'desktop' | 'mobile'
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function Sidebar({ role, userName, userEmail, variant, open, onOpenChange }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const navItems = getNavItems(role)

  async function handleLogout() {
    if (isDemoMode()) {
      toast.success('Signed out')
      router.push('/')
      return
    }
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/login')
  }

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const sidebarContent = (
    <>
      <div className="flex h-16 items-center gap-2 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1dbf73] text-sm font-black text-white">
          S
        </div>
        <span className="text-lg font-black tracking-tight text-[#404145]">
          Sanus<span className="text-[#1dbf73]">.</span>
        </span>
      </div>
      <Separator />
      <NavLinks items={navItems} pathname={pathname} onClick={() => onOpenChange?.(false)} />
      <Separator />
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar size="sm">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userName}</p>
            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-[#62646a]"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </>
  )

  if (variant === 'desktop') {
    return (
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-[#e4e5e7] md:bg-white">
        {sidebarContent}
      </aside>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" showCloseButton className="w-64 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        {sidebarContent}
      </SheetContent>
    </Sheet>
  )
}
