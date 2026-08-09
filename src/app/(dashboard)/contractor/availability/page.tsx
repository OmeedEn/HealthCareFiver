'use client'

import { useState, useEffect } from 'react'
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
import { Plus, Trash2, Calendar, Loader2, CalendarOff } from 'lucide-react'

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

  async function addSlot() {
    if (isDemo) {
      const newSlot: AvailabilitySlot = {
        id: `demo-${Date.now()}`,
        day_of_week: 1,
        start_date: null,
        end_date: null,
        start_time: '08:00',
        end_time: '17:00',
        is_recurring: true,
        is_blocked: false,
        notes: null,
      }
      setSlots([...slots, newSlot])
      toast.success('Availability slot added')
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
      .insert({
        contractor_id: user.id,
        day_of_week: 1,
        start_time: '08:00',
        end_time: '17:00',
        is_recurring: true,
        is_blocked: false,
      })
      .select()
      .single()

    if (error) {
      toast.error('Failed to add availability slot')
    } else if (data) {
      setSlots([...slots, data as AvailabilitySlot])
      toast.success('Availability slot added')
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
          <h1 className="text-2xl font-bold text-[#404145]">Availability</h1>
          <p className="text-[#62646a]">
            Set your weekly availability and block out time off
          </p>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-[#1dbf73]" />
        </div>
      </div>
    )
  }

  const recurringSlots = slots.filter((s) => s.is_recurring && !s.is_blocked)
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
          <h1 className="text-2xl font-bold text-[#404145]">Availability</h1>
          <p className="text-[#62646a]">
            Set your weekly availability and block out time off
          </p>
        </div>
        <Button
          onClick={addSlot}
          disabled={saving}
          className="bg-[#1dbf73] text-white hover:bg-[#19a463]"
        >
          <Plus className="size-4 mr-2" />
          Add slot
        </Button>
      </div>

      {/* Weekly schedule overview grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#404145]">
            <Calendar className="size-5 text-[#1dbf73]" />
            Weekly schedule
          </CardTitle>
          <CardDescription className="text-[#62646a]">
            Your recurring availability for each day of the week
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
                      ? 'border-[#bcebd5] bg-[#e8faf1]'
                      : 'border-[#f1f3f5] bg-white'
                  }`}
                >
                  <div className="text-sm font-medium text-[#404145]">
                    {day.slice(0, 3)}
                  </div>
                  {hasShifts ? (
                    <div className="mt-1 space-y-0.5">
                      {dayShifts.map((s) => (
                        <div
                          key={s.id}
                          className="text-xs text-[#0f8f56]"
                        >
                          {(s.start_time || '08:00').slice(0, 5)}–
                          {(s.end_time || '17:00').slice(0, 5)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-[#6b7280]">Off</div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Editable list of recurring slots */}
          {recurringSlots.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#f1f3f5] py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-[#e8faf1]">
                <Calendar className="size-6 text-[#1dbf73]" />
              </div>
              <h3 className="mt-3 text-lg font-semibold text-[#404145]">
                No recurring availability
              </h3>
              <p className="mt-1 text-sm text-[#62646a]">
                Click &quot;Add slot&quot; above to set hours for a day.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-[#404145]">
                Weekly slots
              </h2>
              <div className="divide-y divide-[#f1f3f5] rounded-lg border border-[#f1f3f5]">
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
                      <span className="text-sm text-[#62646a]">to</span>
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
                      className="border-[#bcebd5] bg-[#e8faf1] text-[#0f8f56]"
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
                        <Trash2 className="size-4 text-[#62646a]" />
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
              <CardTitle className="flex items-center gap-2 text-[#404145]">
                <CalendarOff className="size-5 text-[#1dbf73]" />
                Date blocks
              </CardTitle>
              <CardDescription className="text-[#62646a]">
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
              <div className="flex size-12 items-center justify-center rounded-full bg-[#e8faf1]">
                <Calendar className="size-6 text-[#1dbf73]" />
              </div>
              <h3 className="mt-3 text-lg font-semibold text-[#404145]">
                No date blocks
              </h3>
              <p className="mt-1 text-sm text-[#62646a]">
                Add a block to mark vacation or other time off.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#f1f3f5]">
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
                    <span className="text-sm text-[#62646a]">to</span>
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
                      className="border-[#fecaca] bg-[#fef2f2] text-[#991b1b]"
                    >
                      Blocked
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => deleteSlot(slot.id)}
                      aria-label="Remove block"
                    >
                      <Trash2 className="size-4 text-[#62646a]" />
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
