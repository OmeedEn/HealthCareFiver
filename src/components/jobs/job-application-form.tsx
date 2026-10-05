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
import { isDemoMode } from '@/lib/demo/data'
import { applyToJob } from '@/app/(dashboard)/contractor/jobs/actions'
import { toast } from 'sonner'
import { Loader2Icon } from 'lucide-react'

interface JobApplicationFormProps {
  jobId: string
  /** Up to 3 questions the organization asks every applicant. */
  screeningQuestions?: string[]
  onSuccess?: () => void
}

export function JobApplicationForm({
  jobId,
  screeningQuestions = [],
  onSuccess,
}: JobApplicationFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [coverLetter, setCoverLetter] = useState('')
  const [proposedRate, setProposedRate] = useState('')
  const [availableStartDate, setAvailableStartDate] = useState('')
  const [availability, setAvailability] = useState('')
  const [answers, setAnswers] = useState<string[]>(() => screeningQuestions.map(() => ''))

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
      const result = await applyToJob({
        jobId,
        coverLetter: coverLetter || null,
        proposedRate: proposedRate ? parseFloat(proposedRate) : null,
        availableStartDate: availableStartDate || null,
        availability: availability || null,
        screeningAnswers: screeningQuestions.map((question, i) => ({ question, answer: answers[i] ?? '' })),
      })

      if (!result.ok) {
        if (result.reason === 'agreement_required') {
          toast.error(result.message, {
            action: {
              label: 'Go live',
              onClick: () => {
                window.location.href = result.href ?? '/go-live'
              },
            },
          })
        } else {
          toast.error(result.message)
        }
        return
      }

      toast.success('Application submitted successfully!')
      setOpen(false)
      setCoverLetter('')
      setProposedRate('')
      setAvailableStartDate('')
      setAvailability('')
      setAnswers(screeningQuestions.map(() => ''))
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
            We&apos;ll send your Sanus profile. Add an optional note, your availability, and
            answers to any screening questions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {screeningQuestions.map((q, i) => (
            <div key={i} className="space-y-1.5">
              <Label htmlFor={`screening_${i}`}>{q}</Label>
              <Textarea
                id={`screening_${i}`}
                required
                rows={2}
                maxLength={2000}
                value={answers[i] ?? ''}
                onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
              />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="availability">Your availability</Label>
            <Input
              id="availability"
              placeholder="e.g. Weekends, Tue/Thu evenings"
              maxLength={500}
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cover_letter">Note (optional)</Label>
            <Textarea
              id="cover_letter"
              placeholder="Anything you'd like the organization to know"
              rows={4}
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
