'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu as MenuPrimitive } from '@base-ui/react/menu'
import { toast } from 'sonner'
import { ChevronDown, LogOut } from 'lucide-react'
import { signOutAndRedirect } from '@/lib/auth/sign-out'
import { isDemoMode } from '@/lib/demo/data'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { userMenuFor } from './nav-config'
import { initialsOf, type SessionUser } from './use-session-user'

const ITEM_CLASS =
  'flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[#3a3934] outline-hidden select-none data-highlighted:bg-[#eeebe4] data-highlighted:text-[#1a1a17] [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[#5f5d57]'

export function useSignOut() {
  const router = useRouter()
  return async function signOut() {
    if (isDemoMode()) {
      toast.success('Signed out')
      router.push('/')
      return
    }
    // Back to the homepage, which is where signed-in users land too.
    await signOutAndRedirect('/')
  }
}

export function UserAvatar({ user, className }: { user: SessionUser; className?: string }) {
  return (
    <Avatar className={className}>
      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
      <AvatarFallback className="bg-[#eceefe] text-xs font-semibold text-[#2330c8]">
        {initialsOf(user.name)}
      </AvatarFallback>
    </Avatar>
  )
}

/** Avatar dropdown: the way into everything that's "mine". */
export function UserMenu({ user }: { user: SessionUser }) {
  const signOut = useSignOut()
  const groups = userMenuFor(user.role, user.id)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 outline-none transition hover:bg-[#eeebe4] focus-visible:ring-2 focus-visible:ring-[#2f3cf5]"
      >
        <UserAvatar user={user} />
        <span className="hidden max-w-[9rem] truncate text-sm font-medium text-[#1a1a17] xl:block">
          {user.name}
        </span>
        <ChevronDown className="size-4 text-[#5f5d57]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-60 p-1">
        <div className="px-2 py-2">
          <p className="truncate text-sm font-semibold text-[#1a1a17]">{user.name}</p>
          {user.email && <p className="truncate text-xs text-[#5f5d57]">{user.email}</p>}
        </div>
        {groups.map((group, i) => (
          <Fragment key={i}>
            <DropdownMenuSeparator />
            {group.map((item) => {
              const Icon = item.icon
              return (
                <MenuPrimitive.LinkItem
                  key={item.label}
                  closeOnClick
                  className={ITEM_CLASS}
                  render={<Link href={item.href} />}
                >
                  <Icon />
                  {item.label}
                </MenuPrimitive.LinkItem>
              )
            })}
          </Fragment>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="gap-2 px-2 py-1.5">
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
