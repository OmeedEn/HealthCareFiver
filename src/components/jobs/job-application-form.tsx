'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/data'
import { toast } from 'sonner'
import { Loader2Icon } from 'lucide-react'

interface JobApplicationFormProps {
  jobId: string
  onSuccess?: () => void
}

export function JobApplicationForm({
  jobId,
  onSuccess,
}: JobApplicationFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [coverLetter, setCoverLetter] = useState('')
  const [proposedRate, setProposedRate] = useState('')
  const [availableStartDate, setAvailableStartDate] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (isDemoMode()) {
      toast.success('Application submitted successfully! (demo mode)')
      setOpen(false)
      setCoverLetter('')
      setProposedRate('')
      setAvailableStartDate('')
      setLoading(false)
      onSuccess?.()
      return
    }

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error('You must be logged in to apply.')
        return
      }

      const { error } = await supabase.from('job_applications').insert({
        job_id: jobId,
        contractor_id: user.id,
        status: 'applied',
        cover_letter: coverLetter || null,
        proposed_rate: proposedRate ? parseFloat(proposedRate) : null,
        available_start_date: availableStartDate || null,
      })

      if (error) {
        if (error.code === '23505') {
          toast.error('You have already applied to this job.')
        } else {
          toast.error('Failed to submit application. Please try again.')
        }
        return
      }

      toast.success('Application submitted successfully!')
      setOpen(false)
      setCoverLetter('')
      setProposedRate('')
      setAvailableStartDate('')
      onSuccess?.()
    } catch {
      toast.error('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg">Apply Now</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Apply for this Job</DialogTitle>
          <DialogDescription>
            Submit your application. You can include an optional cover letter and
            proposed rate.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cover_letter">Cover Letter</Label>
            <Textarea
              id="cover_letter"
              placeholder="Tell the facility why you're a great fit..."
              rows={5}
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proposed_rate">Proposed Rate ($)</Label>
            <Input
              id="proposed_rate"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 45.00"
              value={proposedRate}
              onChange={(e) => setProposedRate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="available_start_date">Available Start Date</Label>
            <Input
              id="available_start_date"
              type="date"
              value={availableStartDate}
              onChange={(e) => setAvailableStartDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2Icon className="size-4 animate-spin" />}
              Submit Application
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
