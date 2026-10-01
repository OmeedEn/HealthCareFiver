'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Bug, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function ReportBugButton() {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setSubmitting(true)
    try {
      const res = await fetch('/api/bug-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.get('title'),
          description: form.get('description'),
          severity: form.get('severity'),
          pageUrl: window.location.href,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not send report')
      toast.success("Thanks — we've got it and will take a look.")
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send report')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-1.5 text-[#62646a]">
            <Bug className="size-4" />
            <span className="hidden sm:inline">Report a bug</span>
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Report a bug</DialogTitle>
          <DialogDescription>
            Tell us what went wrong. Please don&apos;t include patient health information.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bug-title">What happened?</Label>
            <Input id="bug-title" name="title" required maxLength={200} placeholder="e.g. Upload button does nothing" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bug-description">Details (optional)</Label>
            <Textarea
              id="bug-description"
              name="description"
              maxLength={5000}
              rows={4}
              placeholder="What were you trying to do, and what did you expect?"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bug-severity">How bad is it?</Label>
            <select
              id="bug-severity"
              name="severity"
              defaultValue="medium"
              className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
            >
              <option value="low">Minor annoyance</option>
              <option value="medium">Something isn&apos;t working</option>
              <option value="high">Blocks me from finishing</option>
              <option value="critical">Urgent / data looks wrong</option>
            </select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting} className="bg-[#1dbf73] text-white hover:bg-[#19a463]">
              {submitting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Send report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
