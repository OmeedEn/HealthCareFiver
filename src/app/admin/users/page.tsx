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
import { Search, MoreHorizontal, Loader2 } from 'lucide-react'

interface UserRow {
  id: string
  email: string | null
  role: string
  is_active: boolean
  created_at: string
  display_name: string
}

const roleBadgeVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  contractor: 'secondary',
  facility: 'outline',
  staffing_agency: 'outline',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let cancelled = false

    async function fetchUsers() {
      const { data: profiles } = await supabase
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
        supabase
          .from('contractor_profiles')
          .select('id, first_name, last_name')
          .in('id', ids),
        supabase
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

      const term = search.trim().toLowerCase()
      const filtered = term
        ? rows.filter(
            (r) =>
              r.display_name.toLowerCase().includes(term) ||
              (r.email ?? '').toLowerCase().includes(term)
          )
        : rows

      setUsers(filtered)
      setLoading(false)
    }

    fetchUsers()
    return () => {
      cancelled = true
    }
  }, [supabase, search])

  function handleSearchChange(value: string) {
    setLoading(true)
    setSearch(value)
  }

  async function handleStatusChange(userId: string, nextActive: boolean) {
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">User Management</h1>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No users found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[60px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.display_name}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant[user.role] ?? 'outline'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.is_active ? 'default' : 'secondary'}
                        className={
                          user.is_active
                            ? 'bg-green-100 text-green-800'
                            : ''
                        }
                      >
                        {user.is_active ? 'active' : 'inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(user.created_at)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-xs" />
                          }
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {user.is_active ? (
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() =>
                                handleStatusChange(user.id, false)
                              }
                            >
                              Deactivate
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
