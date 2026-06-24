'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/data'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { Menu, User, Settings, LogOut } from 'lucide-react'
import { Sidebar } from './sidebar'
import { NotificationsBell } from './notifications-bell'

interface HeaderProps {
  role: 'contractor' | 'facility' | 'admin'
  userName: string
  userEmail: string
}

export function Header({ role, userName, userEmail }: HeaderProps) {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

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

  return (
    <>
      <header className="flex h-14 items-center gap-4 border-b border-[#e4e5e7] bg-white px-4 md:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>

        <div className="flex-1" />

        <NotificationsBell />

        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-2 rounded-md p-1 outline-none hover:bg-[#f5f5f5]"
          >
            <Avatar size="sm">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8}>
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground">{userEmail}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push('/settings')}
            >
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push('/settings')}
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Mobile sidebar drawer, controlled by the hamburger button above */}
      <Sidebar
        role={role}
        userName={userName}
        userEmail={userEmail}
        variant="mobile"
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
      />
    </>
  )
}
