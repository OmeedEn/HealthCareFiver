'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'

interface TimesheetFormProps {
  contractId: string
  contractorId: string
  facilityId: string
  onSuccess?: () => void
}

export function TimesheetForm({
  contractId,
  contractorId,
  facilityId,
  onSuccess,
}: TimesheetFormProps) {
  const [shiftDate, setShiftDate] = useState('')
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [breakMinutes, setBreakMinutes] = useState('0')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const calculateTotalHours = (): number => {
    if (!clockIn || !clockOut) return 0
    const inTime = new Date(clockIn).getTime()
    const outTime = new Date(clockOut).getTime()
    if (outTime <= inTime) return 0
    const diffMinutes = (outTime - inTime) / 60000
    const breakMins = parseInt(breakMinutes) || 0
    return Math.max(0, (diffMinutes - breakMins) / 60)
  }

  const totalHours = calculateTotalHours()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shiftDate || !clockIn || !clockOut) {
      toast.error('Please fill in all required fields.')
      return
    }
    if (totalHours <= 0) {
      toast.error('Clock out must be after clock in (minus break).')
      return
    }

    setSubmitting(true)

    if (isDemoMode()) {
      toast.success('Timesheet submitted successfully. (demo mode)')
      setShiftDate('')
      setClockIn('')
      setClockOut('')
      setBreakMinutes('0')
      setNotes('')
      setSubmitting(false)
      onSuccess?.()
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase.from('timesheets').insert({
        contract_id: contractId,
        contractor_id: contractorId,
        facility_id: facilityId,
        shift_date: shiftDate,
        clock_in: clockIn,
        clock_out: clockOut,
        break_minutes: parseInt(breakMinutes) || 0,
        total_hours: parseFloat(totalHours.toFixed(2)),
        notes: notes.trim() || null,
        status: 'submitted',
      })

      if (error) {
        toast.error('Failed to submit timesheet.')
        return
      }

      toast.success('Timesheet submitted successfully.')
      setShiftDate('')
      setClockIn('')
      setClockOut('')
      setBreakMinutes('0')
      setNotes('')
      onSuccess?.()
    } catch {
      toast.error('An unexpected error occurred.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit Timesheet</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="shift_date">Shift Date</Label>
              <Input
                id="shift_date"
                type="date"
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="break_minutes">Break (minutes)</Label>
              <Input
                id="break_minutes"
                type="number"
                min="0"
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="clock_in">Clock In</Label>
              <Input
                id="clock_in"
                type="datetime-local"
                value={clockIn}
                onChange={(e) => setClockIn(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clock_out">Clock Out</Label>
              <Input
                id="clock_out"
                type="datetime-local"
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
                required
              />
            </div>
          </div>
          {totalHours > 0 && (
            <p className="text-sm text-muted-foreground">
              Total hours: <span className="font-medium">{totalHours.toFixed(2)}</span>
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this shift..."
              rows={3}
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2Icon className="size-4 animate-spin" />}
            Submit Timesheet
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
