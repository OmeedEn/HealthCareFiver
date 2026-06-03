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
import { Plus, Trash2, Calendar } from 'lucide-react'

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

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-lg bg-muted animate-pulse"
          />
        ))}
      </div>
    )
  }

  const recurringSlots = slots.filter((s) => s.is_recurring && !s.is_blocked)
  const blockedSlots = slots.filter((s) => s.is_blocked)

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Availability</h1>
          <p className="text-muted-foreground">
            Set your weekly availability and block out time off
          </p>
        </div>
        <Button onClick={addSlot} disabled={saving}>
          <Plus className="h-4 w-4 mr-2" />
          Add Slot
        </Button>
      </div>

      {/* Weekly Recurring */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Weekly Schedule
          </CardTitle>
          <CardDescription>
            Your recurring weekly availability
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recurringSlots.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No recurring availability set. Click &quot;Add Slot&quot; to get
              started.
            </p>
          ) : (
            <div className="space-y-3">
              {recurringSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center gap-3 p-3 rounded-lg border"
                >
                  <Select
                    value={String(slot.day_of_week ?? 0)}
                    onValueChange={(v) =>
                      updateSlot(slot.id, { day_of_week: parseInt(v ?? '0') })
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
                        updateSlot(slot.id, { start_time: e.target.value })
                      }
                      className="w-32"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={slot.end_time || '17:00'}
                      onChange={(e) =>
                        updateSlot(slot.id, { end_time: e.target.value })
                      }
                      className="w-32"
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteSlot(slot.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Blocked Time */}
      <Card>
        <CardHeader>
          <CardTitle>Time Off / Blocked</CardTitle>
          <CardDescription>
            Block out dates when you&apos;re not available
          </CardDescription>
        </CardHeader>
        <CardContent>
          {blockedSlots.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No blocked time. Add a slot and mark it as blocked for time off.
            </p>
          ) : (
            <div className="space-y-3">
              {blockedSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-red-200 bg-red-50"
                >
                  <Badge variant="destructive">Blocked</Badge>
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={slot.start_date || ''}
                      onChange={(e) =>
                        updateSlot(slot.id, { start_date: e.target.value })
                      }
                      className="w-40"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="date"
                      value={slot.end_date || ''}
                      onChange={(e) =>
                        updateSlot(slot.id, { end_date: e.target.value })
                      }
                      className="w-40"
                    />
                  </div>
                  <Input
                    placeholder="Notes (e.g., Vacation)"
                    value={slot.notes || ''}
                    onChange={(e) =>
                      updateSlot(slot.id, { notes: e.target.value })
                    }
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteSlot(slot.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button
            variant="outline"
            className="mt-4"
            onClick={async () => {
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

              if (!error && data) {
                setSlots([...slots, data as AvailabilitySlot])
              }
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Block Time Off
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
