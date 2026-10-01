import { AlertCircle, Clock } from 'lucide-react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ORG_BANNER, isOrgStatus } from '@/lib/org/review'

const TONE = {
  info: { card: 'border-[#f5deb3] bg-[#fdf6e3]', title: 'text-[#b8860b]', Icon: Clock },
  warning: { card: 'border-[#f5c6cb] bg-[#fdecea]', title: 'text-[#c0392b]', Icon: AlertCircle },
  danger: { card: 'border-[#f5c6cb] bg-[#fdecea]', title: 'text-[#c0392b]', Icon: AlertCircle },
} as const

/** Top-of-dashboard banner for organizations that aren't approved yet. */
export function OrgReviewBanner({
  status,
  notes,
}: {
  status: string | null
  notes: string | null
}) {
  if (!isOrgStatus(status) || status === 'approved') return null

  const config = ORG_BANNER[status]
  const tone = TONE[config.tone]
  const shownNotes = config.showNotes ? notes?.trim() || null : null

  return (
    <Card className={`rounded-md ${tone.card}`}>
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 ${tone.title}`}>
          <tone.Icon className="h-5 w-5 shrink-0" />
          {config.title}
        </CardTitle>
        {shownNotes && (
          <CardDescription className="whitespace-pre-line font-medium text-[#404145]">
            {shownNotes}
          </CardDescription>
        )}
        <CardDescription>{config.body}</CardDescription>
      </CardHeader>
    </Card>
  )
}
