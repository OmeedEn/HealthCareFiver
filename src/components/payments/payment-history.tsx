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
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { ExternalLink } from 'lucide-react'

interface PaymentData {
  id: string
  created_at: string
  description: string
  amount: number
  platform_fee: number
  net_amount: number
  status: string
  invoice_url?: string | null
}

interface PaymentHistoryProps {
  payments: PaymentData[]
  userRole: 'contractor' | 'facility'
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
  processing: { label: 'Processing', className: 'bg-blue-100 text-blue-800' },
  in_escrow: { label: 'In Escrow', className: 'bg-purple-100 text-purple-800' },
  released: { label: 'Released', className: 'bg-green-100 text-green-800' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800' },
  disputed: { label: 'Disputed', className: 'bg-orange-100 text-orange-800' },
}

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? {
    label: status,
    className: 'bg-gray-100 text-gray-800',
  }
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  )
}

export function PaymentHistory({ payments, userRole }: PaymentHistoryProps) {
  if (payments.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No payment history yet.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          {userRole === 'contractor' && (
            <>
              <TableHead className="text-right">Fee</TableHead>
              <TableHead className="text-right">Net</TableHead>
            </>
          )}
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell>{formatDate(payment.created_at)}</TableCell>
            <TableCell className="max-w-[200px] truncate">
              {payment.description}
            </TableCell>
            <TableCell className="text-right">
              {formatCurrency(payment.amount)}
            </TableCell>
            {userRole === 'contractor' && (
              <>
                <TableCell className="text-right text-muted-foreground">
                  -{formatCurrency(payment.platform_fee)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(payment.net_amount)}
                </TableCell>
              </>
            )}
            <TableCell>
              <StatusBadge status={payment.status} />
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                {payment.invoice_url && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    render={
                      <a
                        href={payment.invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                  >
                    <ExternalLink className="size-3" />
                  </Button>
                )}
                {userRole === 'facility' && payment.status === 'pending' && (
                  <Button size="xs" variant="default">
                    Pay
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
