'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { JobApplicationForm } from '@/components/jobs/job-application-form'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { BookmarkIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils/format'

interface JobDetailActionsProps {
  jobId: string
  hasApplied: boolean
  isSaved: boolean
  applicationStatus: string | null
  applicationDate: string | null
}

const STATUS_LABELS: Record<string, string> = {
  applied: 'Applied',
  shortlisted: 'Shortlisted',
  interviewing: 'Interviewing',
  offered: 'Offer Received',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

export function JobDetailActions({
  jobId,
  hasApplied,
  isSaved: initialSaved,
  applicationStatus,
  applicationDate,
}: JobDetailActionsProps) {
  const [saved, setSaved] = useState(initialSaved)
  const router = useRouter()

  const handleSave = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      toast.error('You must be logged in to save jobs.')
      return
    }

    if (saved) {
      await supabase
        .from('saved_jobs')
        .delete()
        .eq('contractor_id', user.id)
        .eq('job_id', jobId)
      setSaved(false)
      toast.success('Job removed from saved.')
    } else {
      await supabase
        .from('saved_jobs')
        .insert({ contractor_id: user.id, job_id: jobId })
      setSaved(true)
      toast.success('Job saved!')
    }
  }

  return (
    <div className="flex flex-col items-end gap-3">
      <div className="flex gap-2">
        <Button variant="outline" size="default" onClick={handleSave}>
          <BookmarkIcon className={saved ? 'fill-current' : ''} />
          {saved ? 'Saved' : 'Save'}
        </Button>
        {hasApplied ? (
          <Button disabled>Already Applied</Button>
        ) : (
          <JobApplicationForm
            jobId={jobId}
            onSuccess={() => router.refresh()}
          />
        )}
      </div>
      {hasApplied && applicationStatus && (
        <div className="text-right text-sm">
          <Badge
            variant={
              applicationStatus === 'rejected'
                ? 'destructive'
                : applicationStatus === 'accepted' ||
                    applicationStatus === 'offered'
                  ? 'default'
                  : 'secondary'
            }
          >
            {STATUS_LABELS[applicationStatus] ?? applicationStatus}
          </Badge>
          {applicationDate && (
            <p className="mt-1 text-xs text-muted-foreground">
              Applied {formatDate(applicationDate)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
