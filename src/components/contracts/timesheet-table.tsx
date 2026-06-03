'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate } from '@/lib/utils/format'
import { CheckIcon, XIcon } from 'lucide-react'

export interface TimesheetItem {
  id: string
  contract_id: string
  shift_date: string
  clock_in: string
  clock_out: string
  break_minutes: number
  total_hours: number
  status: string
  notes: string | null
  created_at: string
}

interface TimesheetTableProps {
  timesheets: TimesheetItem[]
  userRole: 'contractor' | 'facility'
  onApprove?: (timesheetId: string) => void
  onDispute?: (timesheetId: string) => void
}

const STATUS_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  draft: 'outline',
  submitted: 'secondary',
  approved: 'default',
  disputed: 'destructive',
  paid: 'secondary',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  disputed: 'bg-red-100 text-red-700',
  paid: 'bg-purple-100 text-purple-700',
}

export function TimesheetTable({
  timesheets,
  userRole,
  onApprove,
  onDispute,
}: TimesheetTableProps) {
  if (timesheets.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground">No timesheets found.</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Clock In</TableHead>
          <TableHead>Clock Out</TableHead>
          <TableHead>Break</TableHead>
          <TableHead>Total Hours</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {timesheets.map((ts) => (
          <TableRow key={ts.id}>
            <TableCell>{formatDate(ts.shift_date)}</TableCell>
            <TableCell>
              {new Date(ts.clock_in).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </TableCell>
            <TableCell>
              {new Date(ts.clock_out).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </TableCell>
            <TableCell>{ts.break_minutes} min</TableCell>
            <TableCell>{ts.total_hours.toFixed(2)}</TableCell>
            <TableCell>
              <Badge
                variant={STATUS_VARIANT[ts.status] ?? 'outline'}
                className={STATUS_COLORS[ts.status] ?? ''}
              >
                {ts.status}
              </Badge>
            </TableCell>
            <TableCell>
              {userRole === 'facility' && ts.status === 'submitted' && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onApprove?.(ts.id)}
                    title="Approve"
                  >
                    <CheckIcon className="size-3.5 text-green-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onDispute?.(ts.id)}
                    title="Dispute"
                  >
                    <XIcon className="size-3.5 text-red-600" />
                  </Button>
                </div>
              )}
              {userRole === 'contractor' && ts.status === 'draft' && (
                <Button variant="ghost" size="xs">
                  Edit
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
