'use client'

import { useState } from 'react'
import { Loader2, MessageSquare, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { HIRING_TIMELINES, LOOKING_FOR_ENGAGEMENTS } from '@/lib/onboarding/organization'
import { INQUIRY_KIND_LABEL, type InquiryKind } from '@/lib/org/inquiries'
import { sendOrgInquiry } from './inquiry-actions'

export interface LatestInquiry {
  kind: InquiryKind
  status: 'sent' | 'accepted' | 'declined'
  created_at: string
  conversation_id: string | null
}

const STATUS_COPY = {
  sent: 'Sent — waiting for a reply',
  accepted: 'Accepted',
  declined: 'Declined',
} as const

/**
 * "Send inquiry" / "Invite to join our team" on a professional's profile
 * (spec). The message carries role, engagement type and timeline. Approval,
 * opt-out and the daily limit are enforced by the database.
 */
export function InquiryPanel({
  contractorId,
  firstName,
  blockedReason,
  acceptsInquiries,
  latest,
}: {
  contractorId: string
  firstName: string
  blockedReason: string | null
  acceptsInquiries: boolean
  latest: LatestInquiry | null
}) {
  const [kind, setKind] = useState<InquiryKind | null>(null)
  const [role, setRole] = useState('')
  const [engagement, setEngagement] = useState('')
  const [timeline, setTimeline] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const reason = blockedReason ?? (acceptsInquiries ? null : `${firstName} isn’t accepting inquiries right now.`)

  async function send() {
    if (!kind) return
    setSending(true)
    const res = await sendOrgInquiry({ contractorId, kind, role_title: role, engagement_type: engagement, timeline, message })
    setSending(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success(kind === 'invite' ? 'Invitation sent' : 'Inquiry sent')
    setKind(null)
    setRole('')
    setMessage('')
  }

  return (
    <div className="flex max-w-md shrink-0 flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          disabled={!!reason}
          onClick={() => setKind(kind === 'inquiry' ? null : 'inquiry')}
          className="border-[#bcebd5] text-[#0f8f56] hover:bg-[#e8faf1]"
        >
          <MessageSquare className="size-4" data-icon="inline-start" />
          Send inquiry
        </Button>
        <Button
          disabled={!!reason}
          onClick={() => setKind(kind === 'invite' ? null : 'invite')}
          className="bg-[#1dbf73] text-white hover:bg-[#19a463]"
        >
          <UserPlus className="size-4" data-icon="inline-start" />
          Invite to join our team
        </Button>
      </div>
      {reason && <p className="text-right text-xs text-[#62646a]">{reason}</p>}
      {latest && (
        <p className="text-right text-xs text-[#62646a]">
          Your last {latest.kind === 'invite' ? 'invitation' : 'inquiry'}: <strong>{STATUS_COPY[latest.status]}</strong>
          {latest.status === 'accepted' && latest.conversation_id && (
            <> · <a href={`/messages/${latest.conversation_id}`} className="font-semibold text-[#1dbf73] hover:underline">Open conversation</a></>
          )}
        </p>
      )}

      {kind && !reason && (
        <div className="w-full space-y-3 rounded-lg border border-[#e4e5e7] bg-white p-4 text-left">
          <p className="text-sm font-semibold text-[#404145]">{INQUIRY_KIND_LABEL[kind]}</p>
          <label className="block text-sm">
            <span className="font-medium text-[#404145]">Role</span>
            <input value={role} onChange={(e) => setRole(e.target.value)} maxLength={200} placeholder="e.g. Per diem pediatric RN" className="mt-1 h-10 w-full rounded-lg border border-input px-3" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-[#404145]">Engagement type</span>
              <select value={engagement} onChange={(e) => setEngagement(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-input bg-white px-2">
                <option value="" disabled>Select…</option>
                {LOOKING_FOR_ENGAGEMENTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-[#404145]">Timeline</span>
              <select value={timeline} onChange={(e) => setTimeline(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-input bg-white px-2">
                <option value="" disabled>Select…</option>
                {HIRING_TIMELINES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-medium text-[#404145]">Message <span className="font-normal text-[#95979d]">(optional)</span></span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} rows={3} className="mt-1 w-full rounded-lg border border-input px-3 py-2" />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setKind(null)}>Cancel</Button>
            <Button onClick={send} disabled={sending} className="bg-[#1dbf73] text-white hover:bg-[#19a463]">
              {sending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
