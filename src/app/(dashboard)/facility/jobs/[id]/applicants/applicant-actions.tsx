'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/data'
import { toast } from 'sonner'
import { Loader2Icon } from 'lucide-react'

interface ApplicantActionsProps {
  applicationId: string
  currentStatus: string
  jobId: string
}

const ACTIONS: Record<string, { label: string; newStatus: string; variant: 'default' | 'outline' | 'destructive' | 'secondary' }[]> = {
  applied: [
    { label: 'Shortlist', newStatus: 'shortlisted', variant: 'secondary' },
    { label: 'Reject', newStatus: 'rejected', variant: 'destructive' },
  ],
  shortlisted: [
    { label: 'Schedule Interview', newStatus: 'interviewing', variant: 'secondary' },
    { label: 'Reject', newStatus: 'rejected', variant: 'destructive' },
  ],
  interviewing: [
    { label: 'Make Offer', newStatus: 'offered', variant: 'default' },
    { label: 'Reject', newStatus: 'rejected', variant: 'destructive' },
  ],
  offered: [
    { label: 'Mark Accepted', newStatus: 'accepted', variant: 'default' },
    { label: 'Reject', newStatus: 'rejected', variant: 'destructive' },
  ],
}

export function ApplicantActions({
  applicationId,
  currentStatus,
  jobId: _jobId,
}: ApplicantActionsProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const actions = ACTIONS[currentStatus]

  if (!actions || actions.length === 0) return null

  const handleAction = async (newStatus: string) => {
    setLoading(true)
    try {
      if (isDemoMode()) {
        toast.success(`Application status updated to "${newStatus}". (demo mode)`)
        router.refresh()
        setLoading(false)
        return
      }
      const supabase = createClient()
      const { error } = await supabase
        .from('job_applications')
        .update({ status: newStatus })
        .eq('id', applicationId)

      if (error) {
        toast.error('Failed to update application status.')
        return
      }

      toast.success(`Application status updated to "${newStatus}".`)
      router.refresh()
    } catch {
      toast.error('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-2">
      {actions.map((action) => (
        <Button
          key={action.newStatus}
          variant={action.variant}
          size="sm"
          disabled={loading}
          onClick={() => handleAction(action.newStatus)}
        >
          {loading && <Loader2Icon className="size-3 animate-spin" />}
          {action.label}
        </Button>
      ))}
    </div>
  )
}
