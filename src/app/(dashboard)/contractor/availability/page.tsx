'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode, DEMO_AVAILABILITY } from '@/lib/demo/data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Trash2, Calendar, Loader2, CalendarOff, ArrowRight } from 'lucide-react'

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

interface AvailabilitySlot {
  id: string
  day_of_week: number | null
  start_date: string | null
  end_date: string | null
  start_time: string | null
  end_time: string | null
  is_recurring: boolean
  is_blocked: boolean
  notes: string | null
}

export default function AvailabilityPage() {
  const isDemo = isDemoMode()
  const [slots, setSlots] = useState<AvailabilitySlot[]>(() =>
    isDemo ? (DEMO_AVAILABILITY as unknown as AvailabilitySlot[]) : []
  )
  const [loading, setLoading] = useState(!isDemo)
  const [saving, setSaving] = useState(false)
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [newStart, setNewStart] = useState('08:00')
  const [newEnd, setNewEnd] = useState('17:00')

  useEffect(() => {
    if (isDemo) return

    let cancelled = false
    async function fetchAvailability() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const { data, error } = await supabase
        .from('contractor_availability')
        .select('*')
        .eq('contractor_id', user.id)
        .order('day_of_week', { ascending: true })

      if (cancelled) return
      if (!error && data) {
        setSlots(data as AvailabilitySlot[])
      }
      setLoading(false)
    }

    fetchAvailability()
    return () => {
      cancelled = true
    }
  }, [isDemo])

  function toggleDay(day: number) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    )
  }

  async function addSlots() {
    if (selectedDays.length === 0) {
      toast.error('Pick at least one day')
      return
    }
    if (!newStart || !newEnd || newStart >= newEnd) {
      toast.error('End time must be after start time')
      return
    }

    // Skip days that already have this exact window
    const days = selectedDays.filter(
      (d) =>
        !slots.some(
          (s) =>
            s.is_recurring &&
            !s.is_blocked &&
            s.day_of_week === d &&
            (s.start_time ?? '').slice(0, 5) === newStart &&
            (s.end_time ?? '').slice(0, 5) === newEnd
        )
    )
    if (days.length === 0) {
      toast.info('Those days already have this time slot')
      return
    }

    const label = `${days.length} day${days.length === 1 ? '' : 's'}`

    if (isDemo) {
      const now = Date.now()
      const newSlots: AvailabilitySlot[] = days.map((d, i) => ({
        id: `demo-${now}-${i}`,
        day_of_week: d,
        start_date: null,
        end_date: null,
        start_time: newStart,
        end_time: newEnd,
        is_recurring: true,
        is_blocked: false,
        notes: null,
      }))
      setSlots((prev) => [...prev, ...newSlots])
      setSelectedDays([])
      toast.success(`Availability added to ${label}`)
      return
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setSaving(true)
    const { data, error } = await supabase
      .from('contractor_availability')
      .insert(
        days.map((d) => ({
          contractor_id: user.id,
          day_of_week: d,
          start_time: newStart,
          end_time: newEnd,
          is_recurring: true,
          is_blocked: false,
        }))
      )
      .select()

    if (error) {
      toast.error('Failed to add availability')
    } else if (data) {
      setSlots((prev) => [...prev, ...(data as AvailabilitySlot[])])
      setSelectedDays([])
      toast.success(`Availability added to ${label}`)
    }
    setSaving(false)
  }

  async function updateSlot(
    id: string,
    updates: Partial<AvailabilitySlot>
  ) {
    if (isDemo) {
      setSlots(
        slots.map((s) => (s.id === id ? { ...s, ...updates } : s))
      )
      return
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('contractor_availability')
      .update(updates)
      .eq('id', id)

    if (error) {
      toast.error('Failed to update')
    } else {
      setSlots(
        slots.map((s) => (s.id === id ? { ...s, ...updates } : s))
      )
    }
  }

  async function deleteSlot(id: string) {
    if (isDemo) {
      setSlots(slots.filter((s) => s.id !== id))
      toast.success('Slot removed')
      return
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('contractor_availability')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error('Failed to delete')
    } else {
      setSlots(slots.filter((s) => s.id !== id))
      toast.success('Slot removed')
    }
  }

  async function addBlockedTime() {
    if (isDemo) {
      const newSlot: AvailabilitySlot = {
        id: `demo-block-${Date.now()}`,
        day_of_week: null,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        start_time: null,
        end_time: null,
        is_recurring: false,
        is_blocked: true,
        notes: null,
      }
      setSlots([...slots, newSlot])
      toast.success('Block added')
      return
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('contractor_availability')
      .insert({
        contractor_id: user.id,
        is_recurring: false,
        is_blocked: true,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single()

    if (error) {
      toast.error('Failed to add block')
    } else if (data) {
      setSlots([...slots, data as AvailabilitySlot])
      toast.success('Block added')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a17]">Availability</h1>
          <p className="text-[#5f5d57]">
            Set your weekly availability and block out time off
          </p>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-[#2f3cf5]" />
        </div>
      </div>
    )
  }

  const recurringSlots = slots
    .filter((s) => s.is_recurring && !s.is_blocked)
    .sort(
      (a, b) =>
        (a.day_of_week ?? 0) - (b.day_of_week ?? 0) ||
        (a.start_time ?? '').localeCompare(b.start_time ?? '')
    )
  const blockedSlots = slots.filter((s) => s.is_blocked)

  // Group recurring slots by day for the weekly grid summary
  const slotsByDay = new Map<number, AvailabilitySlot[]>()
  for (const s of recurringSlots) {
    if (s.day_of_week == null) continue
    const list = slotsByDay.get(s.day_of_week) ?? []
    list.push(s)
    slotsByDay.set(s.day_of_week, list)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a17]">Availability</h1>
          <p className="text-[#5f5d57]">
            Set your weekly availability and block out time off
          </p>
          <Link
            href="/contractor/rates"
            className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-[#2f3cf5] hover:text-[#2330c8]"
          >
            Set your rates <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Weekly schedule overview grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#1a1a17]">
            <Calendar className="size-5 text-[#2f3cf5]" />
            Weekly schedule
          </CardTitle>
          <CardDescription className="text-[#5f5d57]">
            Your recurring availability for each day of the week
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add availability to one or more days */}
          <div className="space-y-3 rounded-lg border border-[#eeebe4] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[#1a1a17]">
                Add availability
              </h2>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedDays([1, 2, 3, 4, 5])}
                  className="font-medium text-[#2f3cf5] hover:text-[#2330c8]"
                >
                  Weekdays
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDays([0, 6])}
                  className="font-medium text-[#2f3cf5] hover:text-[#2330c8]"
                >
                  Weekends
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDays([0, 1, 2, 3, 4, 5, 6])}
                  className="font-medium text-[#2f3cf5] hover:text-[#2330c8]"
                >
                  Every day
                </button>
                {selectedDays.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedDays([])}
                    className="font-medium text-[#5f5d57] hover:text-[#1a1a17]"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Days">
              {DAYS_OF_WEEK.map((day, i) => {
                const active = selectedDays.includes(i)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(i)}
                    aria-pressed={active}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? 'border-[#2f3cf5] bg-[#2f3cf5] text-white'
                        : 'border-[#eeebe4] bg-white text-[#1a1a17] hover:border-[#c9cdfb]'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                )
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="new-start" className="sr-only">Start</Label>
              <Input
                id="new-start"
                type="time"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                className="w-32"
              />
              <span className="text-sm text-[#5f5d57]">to</span>
              <Label htmlFor="new-end" className="sr-only">End</Label>
              <Input
                id="new-end"
                type="time"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
                className="w-32"
              />
              <Button
                onClick={addSlots}
                disabled={saving || selectedDays.length === 0}
                className="bg-[#2f3cf5] text-white hover:bg-[#2330c8]"
              >
                {saving ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="size-4 mr-2" />
                )}
                {selectedDays.length > 1
                  ? `Add to ${selectedDays.length} days`
                  : 'Add'}
              </Button>
            </div>
          </div>

          {/* 7-day overview */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {DAYS_OF_WEEK.map((day, i) => {
              const dayShifts = slotsByDay.get(i) ?? []
              const hasShifts = dayShifts.length > 0
              return (
                <div
                  key={day}
                  className={`rounded-lg border p-3 ${
                    hasShifts
                      ? 'border-[#c9cdfb] bg-[#eceefe]'
                      : 'border-[#eeebe4] bg-white'
                  }`}
                >
                  <div className="text-sm font-medium text-[#1a1a17]">
                    {day.slice(0, 3)}
                  </div>
                  {hasShifts ? (
                    <div className="mt-1 space-y-0.5">
                      {dayShifts.map((s) => (
                        <div
                          key={s.id}
                          className="text-xs text-[#2330c8]"
                        >
                          {(s.start_time || '08:00').slice(0, 5)}–
                          {(s.end_time || '17:00').slice(0, 5)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-[#5f5d57]">Off</div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Editable list of recurring slots */}
          {recurringSlots.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#eeebe4] py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-[#eceefe]">
                <Calendar className="size-6 text-[#2f3cf5]" />
              </div>
              <h3 className="mt-3 text-lg font-semibold text-[#1a1a17]">
                No recurring availability
              </h3>
              <p className="mt-1 text-sm text-[#5f5d57]">
                Pick one or more days above and add your hours.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-[#1a1a17]">
                Weekly slots
              </h2>
              <div className="divide-y divide-[#eeebe4] rounded-lg border border-[#eeebe4]">
                {recurringSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3"
                  >
                    <Select
                      value={String(slot.day_of_week ?? 0)}
                      onValueChange={(v) =>
                        updateSlot(slot.id, {
                          day_of_week: parseInt(v ?? '0'),
                        })
                      }
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS_OF_WEEK.map((day, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-2">
                      <Label className="sr-only">Start</Label>
                      <Input
                        type="time"
                        value={slot.start_time || '08:00'}
                        onChange={(e) =>
                          updateSlot(slot.id, {
                            start_time: e.target.value,
                          })
                        }
                        className="w-32"
                      />
                      <span className="text-sm text-[#5f5d57]">to</span>
                      <Input
                        type="time"
                        value={slot.end_time || '17:00'}
                        onChange={(e) =>
                          updateSlot(slot.id, { end_time: e.target.value })
                        }
                        className="w-32"
                      />
                    </div>

                    <Badge
                      variant="outline"
                      className="border-[#c9cdfb] bg-[#eceefe] text-[#2330c8]"
                    >
                      Available
                    </Badge>

                    <div className="ml-auto">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => deleteSlot(slot.id)}
                        aria-label="Remove slot"
                      >
                        <Trash2 className="size-4 text-[#5f5d57]" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Date blocks */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-[#1a1a17]">
                <CalendarOff className="size-5 text-[#2f3cf5]" />
                Date blocks
              </CardTitle>
              <CardDescription className="text-[#5f5d57]">
                Block specific dates when you&apos;re not available
              </CardDescription>
            </div>
            <Button variant="outline" onClick={addBlockedTime}>
              <Plus className="size-4 mr-2" />
              Add block
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {blockedSlots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-[#eceefe]">
                <Calendar className="size-6 text-[#2f3cf5]" />
              </div>
              <h3 className="mt-3 text-lg font-semibold text-[#1a1a17]">
                No date blocks
              </h3>
              <p className="mt-1 text-sm text-[#5f5d57]">
                Add a block to mark vacation or other time off.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#eeebe4]">
              {blockedSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 last:border-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="date"
                      value={slot.start_date || ''}
                      onChange={(e) =>
                        updateSlot(slot.id, { start_date: e.target.value })
                      }
                      className="w-40"
                    />
                    <span className="text-sm text-[#5f5d57]">to</span>
                    <Input
                      type="date"
                      value={slot.end_date || ''}
                      onChange={(e) =>
                        updateSlot(slot.id, { end_date: e.target.value })
                      }
                      className="w-40"
                    />
                    <Input
                      placeholder="Reason (e.g., Vacation)"
                      value={slot.notes || ''}
                      onChange={(e) =>
                        updateSlot(slot.id, { notes: e.target.value })
                      }
                      className="w-48"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-[#f4c7c2] bg-[#fdecea] text-[#b42318]"
                    >
                      Blocked
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => deleteSlot(slot.id)}
                      aria-label="Remove block"
                    >
                      <Trash2 className="size-4 text-[#5f5d57]" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
