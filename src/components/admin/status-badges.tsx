import { Badge } from '@/components/ui/badge'

const VERIFICATION: Record<string, { label: string; className: string }> = {
  not_submitted: { label: 'Not submitted', className: 'bg-gray-100 text-gray-600' },
  pending_review: { label: 'Pending review', className: 'bg-amber-100 text-amber-800' },
  more_info_requested: { label: 'More info requested', className: 'bg-blue-100 text-blue-800' },
  approved: { label: 'Approved', className: 'bg-[#e8faf1] text-[#0f8f56]' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
}

export function VerificationBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-[#9ca3af]">n/a</span>
  const v = VERIFICATION[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' }
  return <Badge className={v.className}>{v.label}</Badge>
}

const BUG_STATUS: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  in_progress: 'bg-amber-100 text-amber-800',
  resolved: 'bg-[#e8faf1] text-[#0f8f56]',
  wont_fix: 'bg-gray-100 text-gray-600',
}

export function BugStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={BUG_STATUS[status] ?? 'bg-gray-100 text-gray-600'}>
      {status.replace('_', ' ')}
    </Badge>
  )
}

const SEVERITY: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-amber-100 text-amber-800',
  critical: 'bg-red-600 text-white',
}

export function SeverityBadge({ severity }: { severity: string }) {
  return <Badge className={SEVERITY[severity] ?? SEVERITY.medium}>{severity}</Badge>
}

/** "Confirmed" / "Unconfirmed" from auth.users.email_confirmed_at. */
export function EmailConfirmedBadge({ at }: { at: string | null }) {
  return at ? (
    <Badge className="bg-[#e8faf1] text-[#0f8f56]">Confirmed</Badge>
  ) : (
    <Badge className="bg-gray-100 text-gray-600">Unconfirmed</Badge>
  )
}
