'use client'

import { useEffect, useState, useCallback } from 'react'
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
  user_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  role: string
  status: string | null
  created_at: string
}

const roleBadgeVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  contractor: 'secondary',
  facility: 'outline',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchUsers = useCallback(
    async (searchTerm: string) => {
      setLoading(true)

      let query = supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email, role, status, created_at')
        .order('created_at', { ascending: false })
        .limit(100)

      if (searchTerm.trim()) {
        query = query.or(
          `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`
        )
      }

      const { data } = await query
      setUsers((data ?? []) as unknown as UserRow[])
      setLoading(false)
    },
    [supabase]
  )

  useEffect(() => {
    fetchUsers(search)
  }, [fetchUsers, search])

  async function handleStatusChange(userId: string, newStatus: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('user_id', userId)

    if (error) {
      toast.error('Failed to update user status')
    } else {
      toast.success(`User ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === userId ? { ...u, status: newStatus } : u
        )
      )
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('user_id', userId)

    if (error) {
      toast.error('Failed to update user role')
    } else {
      toast.success(`User role updated to ${newRole}`)
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === userId ? { ...u, role: newRole } : u
        )
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
              onChange={(e) => setSearch(e.target.value)}
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
                  <TableRow key={user.user_id}>
                    <TableCell className="font-medium">
                      {user.first_name ?? ''} {user.last_name ?? ''}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant[user.role] ?? 'outline'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.status === 'active' ? 'default' : 'secondary'
                        }
                        className={
                          user.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : ''
                        }
                      >
                        {user.status ?? 'unknown'}
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
                          <DropdownMenuItem
                            onClick={() =>
                              window.open(
                                `/admin/users/${user.user_id}`,
                                '_self'
                              )
                            }
                          >
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {user.status === 'active' ? (
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() =>
                                handleStatusChange(user.user_id, 'inactive')
                              }
                            >
                              Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusChange(user.user_id, 'active')
                              }
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
                                onClick={() =>
                                  handleRoleChange(user.user_id, role)
                                }
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
