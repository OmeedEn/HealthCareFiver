'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDate } from '@/lib/utils/format'
import { toast } from 'sonner'
import { Search, MoreHorizontal, Loader2, Users } from 'lucide-react'
import {
  DEMO_CONTRACTOR,
  DEMO_FACILITY,
  DEMO_PROVIDERS,
  isDemoMode,
} from '@/lib/demo/data'

interface UserRow {
  id: string
  email: string | null
  role: string
  is_active: boolean
  created_at: string
  display_name: string
}

function buildDemoUsers(): UserRow[] {
  const demoUsers: UserRow[] = [
    {
      id: DEMO_CONTRACTOR.id,
      email: DEMO_CONTRACTOR.email,
      role: 'contractor',
      is_active: true,
      created_at: '2026-01-15T10:00:00Z',
      display_name: `${DEMO_CONTRACTOR.first_name} ${DEMO_CONTRACTOR.last_name}`,
    },
    {
      id: DEMO_FACILITY.id,
      email: DEMO_FACILITY.email,
      role: 'facility',
      is_active: true,
      created_at: '2026-01-20T10:00:00Z',
      display_name: DEMO_FACILITY.facility_name,
    },
    ...DEMO_PROVIDERS.map((p, i) => ({
      id: p.id,
      email: `${p.first_name.toLowerCase()}.${p.last_name.toLowerCase()}@example.com`,
      role: 'contractor',
      is_active: i % 2 === 0,
      created_at: `2026-02-${10 + i}T10:00:00Z`,
      display_name: `${p.first_name} ${p.last_name}`,
    })),
  ]
  return demoUsers
}

export default function AdminUsersPage() {
  const demoMode = isDemoMode()
  const [users, setUsers] = useState<UserRow[]>(() =>
    demoMode ? buildDemoUsers() : []
  )
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(!demoMode)
  const supabase = useMemo(
    () => (demoMode ? null : createClient()),
    [demoMode]
  )

  useEffect(() => {
    if (demoMode || !supabase) {
      return
    }

    let cancelled = false

    async function fetchUsers() {
      const client = supabase!
      const { data: profiles } = await client
        .from('profiles')
        .select('id, email, role, is_active, created_at')
        .order('created_at', { ascending: false })
        .limit(100)

      if (cancelled || !profiles) {
        setLoading(false)
        return
      }

      const ids = profiles.map((p) => p.id)
      const [contractors, facilities] = await Promise.all([
        client
          .from('contractor_profiles')
          .select('id, first_name, last_name')
          .in('id', ids),
        client
          .from('facility_profiles')
          .select('id, facility_name')
          .in('id', ids),
      ])

      const nameMap = new Map<string, string>()
      for (const row of contractors.data ?? []) {
        nameMap.set(
          row.id,
          `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || '—'
        )
      }
      for (const row of facilities.data ?? []) {
        if (!nameMap.has(row.id)) nameMap.set(row.id, row.facility_name ?? '—')
      }

      const rows: UserRow[] = profiles.map((p) => ({
        id: p.id,
        email: p.email,
        role: p.role,
        is_active: p.is_active,
        created_at: p.created_at,
        display_name: nameMap.get(p.id) ?? '—',
      }))

      setUsers(rows)
      setLoading(false)
    }

    fetchUsers()
    return () => {
      cancelled = true
    }
  }, [supabase, demoMode])

  function handleSearchChange(value: string) {
    setSearch(value)
  }

  async function handleStatusChange(userId: string, nextActive: boolean) {
    if (demoMode) {
      toast.success(`User ${nextActive ? 'activated' : 'deactivated'}`)
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, is_active: nextActive } : u
        )
      )
      return
    }
    if (!supabase) return
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: nextActive })
      .eq('id', userId)

    if (error) {
      toast.error('Failed to update user status')
    } else {
      toast.success(`User ${nextActive ? 'activated' : 'deactivated'}`)
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, is_active: nextActive } : u
        )
      )
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    if (demoMode) {
      toast.success(`User role updated to ${newRole}`)
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      )
      return
    }
    if (!supabase) return
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) {
      toast.error('Failed to update user role')
    } else {
      toast.success(`User role updated to ${newRole}`)
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      )
    }
  }

  const term = search.trim().toLowerCase()
  const visibleUsers = term
    ? users.filter(
        (r) =>
          r.display_name.toLowerCase().includes(term) ||
          (r.email ?? '').toLowerCase().includes(term)
      )
    : users

  function roleBadge(role: string) {
    if (role === 'facility') {
      return (
        <Badge className="bg-[#e8faf1] text-[#0f8f56] hover:bg-[#e8faf1]">
          {role}
        </Badge>
      )
    }
    if (role === 'admin') {
      return (
        <Badge className="bg-[#1dbf73] text-white hover:bg-[#19a463]">
          {role}
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="border-[#e5e7eb] text-[#62646a]">
        {role}
      </Badge>
    )
  }

  return (
    <div className="space-y-6 font-sans">
      <h1 className="text-2xl font-bold text-[#404145]">User Management</h1>

      <Card className="border-[#f1f3f5]">
        <CardHeader>
          <CardTitle className="text-[#404145]">All Users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#6b7280]" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-[#1dbf73]" />
            </div>
          ) : visibleUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-[#e8faf1]">
                <Users className="size-6 text-[#1dbf73]" />
              </div>
              <p className="text-sm text-[#62646a]">No users found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[#404145]">Name</TableHead>
                  <TableHead className="text-[#404145]">Email</TableHead>
                  <TableHead className="text-[#404145]">Role</TableHead>
                  <TableHead className="text-[#404145]">Status</TableHead>
                  <TableHead className="text-[#404145]">Joined</TableHead>
                  <TableHead className="w-[60px] text-[#404145]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleUsers.map((user) => (
                  <TableRow
                    key={user.id}
                    className="border-b border-[#f1f3f5] last:border-0"
                  >
                    <TableCell className="font-medium text-[#404145]">
                      {user.display_name}
                    </TableCell>
                    <TableCell className="text-[#62646a]">
                      {user.email}
                    </TableCell>
                    <TableCell>{roleBadge(user.role)}</TableCell>
                    <TableCell>
                      {user.is_active ? (
                        <Badge className="bg-[#1dbf73] text-white hover:bg-[#19a463]">
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Unverified</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-[#62646a]">
                      {formatDate(user.created_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-xs" />
                          }
                        >
                          <MoreHorizontal className="size-4 text-[#62646a]" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {user.is_active ? (
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() =>
                                handleStatusChange(user.id, false)
                              }
                            >
                              Suspend
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(user.id, true)}
                            >
                              Activate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {['admin', 'contractor', 'facility']
                            .filter((r) => r !== user.role)
                            .map((role) => (
                              <DropdownMenuItem
                                key={role}
                                onClick={() => handleRoleChange(user.id, role)}
                              >
                                Set as {role}
                              </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
