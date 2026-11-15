'use client'

import { useState, useEffect, useMemo } from 'react'
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
import {
  Plus,
  Trash2,
  Calendar,
  Loader2,
  CalendarOff,
  ArrowRight,
  Pencil,
  Check,
  AlertCircle,
} from 'lucide-react'
import {
  DAYS_OF_WEEK,
  browserTimeZone,
  findOverlaps,
  isOvernight,
  isValidTimeZone,
  timeZoneOptions,
  todayIn,
  type WeeklyWindow,
} from './availability-rules'

// Weekly working hours and date blocks for a professional. Nothing is
// written until the person presses Add / Save; opening an editor or pressing
// Cancel never touches stored availability. Times are wall-clock times in an
// explicit IANA timezone, so "9:00–17:00 America/Chicago" stays 9–5 local
// across daylight-saving changes.

interface AvailabilitySlot {
  id: string
  contractor_id?: string
  day_of_week: number | null
  start_date: string | null
  end_date: string | null
  start_time: string | null
  end_time: string | null
  is_recurring: boolean
  is_blocked: boolean
  notes: string | null
  /** contractor_availability.timezone (migration 20261114100100); null = not set. */
  timezone?: string | null
}

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving'; what: string }
  | { kind: 'saved'; what: string }
  | { kind: 'error'; what: string }

type WindowDraft = { day: number; start: string; end: string }
type BlockDraft = { start: string; end: string; notes: string }

const hhmm = (t: string | null | undefined, fallback = '') => (t ? t.slice(0, 5) : fallback)

/** True when the error is the timezone column not existing yet (migration not applied). */
function isMissingTimezoneColumn(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  return error.code === 'PGRST204' || /timezone/i.test(error.message ?? '')
}

function windowOf(s: AvailabilitySlot): WeeklyWindow | null {
  if (s.day_of_week == null || !s.start_time || !s.end_time) return null
  return { id: s.id, day: s.day_of_week, start: hhmm(s.start_time), end: hhmm(s.end_time) }
}

export default function AvailabilityPage() {
  const isDemo = isDemoMode()
  const [slots, setSlots] = useState<AvailabilitySlot[]>(() =>
    isDemo ? (DEMO_AVAILABILITY as unknown as AvailabilitySlot[]) : []
  )
  const [loading, setLoading] = useState(!isDemo)
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })
  const saving = saveState.kind === 'saving'
  // false once we learn the column isn't there yet; inserts then skip it.
  const [tzColumn, setTzColumn] = useState(true)

  const [timeZone, setTimeZone] = useState<string>(() => browserTimeZone())
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [newStart, setNewStart] = useState('08:00')
  const [newEnd, setNewEnd] = useState('17:00')

  // Row editors (unsaved until Save).
  const [editingId, setEditingId] = useState<string | null>(null)
  const [windowDraft, setWindowDraft] = useState<WindowDraft | null>(null)
  const [blockDraft, setBlockDraft] = useState<BlockDraft | null>(null)
  // "Add block" editor (unsaved until Save).
  const [newBlock, setNewBlock] = useState<BlockDraft | null>(null)

  const zones = useMemo(() => timeZoneOptions(timeZone), [timeZone])

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
        const rows = data as AvailabilitySlot[]
        setSlots(rows)
        if (rows.length > 0 && !('timezone' in rows[0])) setTzColumn(false)
        // Default to the zone already used on saved hours, if there's one.
        const saved = rows.map((r) => r.timezone).find((z): z is string => !!z && isValidTimeZone(z))
        if (saved) setTimeZone(saved)
      }
      setLoading(false)
    }

    fetchAvailability()
    return () => {
      cancelled = true
    }
  }, [isDemo])

  const recurringSlots = slots
    .filter((s) => s.is_recurring && !s.is_blocked)
    .sort(
      (a, b) =>
        (a.day_of_week ?? 0) - (b.day_of_week ?? 0) ||
        (a.start_time ?? '').localeCompare(b.start_time ?? '')
    )
  const blockedSlots = slots
    .filter((s) => s.is_blocked)
    .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))
  const existingWindows = recurringSlots.map(windowOf).filter((w): w is WeeklyWindow => !!w)

  /* ── writes ── */

  async function currentUserId(): Promise<string | null> {
    if (isDemo) return 'demo'
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user?.id ?? null
  }

  /** Insert rows (with timezone when the column exists). Returns the stored rows. */
  async function insertRows(rows: Omit<AvailabilitySlot, 'id'>[] | AvailabilitySlot[]): Promise<AvailabilitySlot[] | null> {
    if (isDemo) {
      return rows.map((r) => ({ id: (r as AvailabilitySlot).id ?? `demo-${crypto.randomUUID()}`, ...r }) as AvailabilitySlot)
    }
    const supabase = createClient()
    const strip = (r: object) => {
      const copy = { ...(r as Record<string, unknown>) }
      delete copy.timezone
      return copy
    }
    let payload = tzColumn ? rows : rows.map(strip)
    let { data, error } = await supabase.from('contractor_availability').insert(payload).select()
    if (error && tzColumn && isMissingTimezoneColumn(error)) {
      setTzColumn(false)
      payload = rows.map(strip)
      ;({ data, error } = await supabase.from('contractor_availability').insert(payload).select())
    }
    if (error || !data) return null
    return data as AvailabilitySlot[]
  }

  async function updateRow(id: string, updates: Partial<AvailabilitySlot>): Promise<boolean> {
    if (isDemo) return true
    const supabase = createClient()
    const payload = { ...updates }
    if (!tzColumn) delete payload.timezone
    let { error } = await supabase.from('contractor_availability').update(payload).eq('id', id)
    if (error && 'timezone' in payload && isMissingTimezoneColumn(error)) {
      setTzColumn(false)
      delete payload.timezone
      ;({ error } = await supabase.from('contractor_availability').update(payload).eq('id', id))
    }
    return !error
  }

  async function deleteRows(ids: string[]): Promise<boolean> {
    if (isDemo) return true
    const supabase = createClient()
    const { error } = await supabase.from('contractor_availability').delete().in('id', ids)
    return !error
  }

  /* ── weekly hours: add ── */

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
    if (!newStart || !newEnd || newStart === newEnd) {
      toast.error('Start and end time can’t be the same')
      return
    }
    const proposed = selectedDays.map((d) => ({ day: d, start: newStart, end: newEnd }))
    const conflicts = findOverlaps(proposed, existingWindows)
    if (conflicts.length > 0) {
      const days = [...new Set(conflicts.map((c) => DAYS_OF_WEEK[c.day].slice(0, 3)))].join(', ')
      toast.error(`Overlaps hours you already have on ${days}. Edit or remove those first.`)
      return
    }

    const userId = await currentUserId()
    if (!userId) return
    const label = `${selectedDays.length} day${selectedDays.length === 1 ? '' : 's'}`
    setSaveState({ kind: 'saving', what: 'Adding hours' })
    const inserted = await insertRows(
      selectedDays.map((d) => ({
        contractor_id: userId,
        day_of_week: d,
        start_date: null,
        end_date: null,
        start_time: newStart,
        end_time: newEnd,
        is_recurring: true,
        is_blocked: false,
        notes: null,
        timezone: timeZone,
      }))
    )
    if (!inserted) {
      setSaveState({ kind: 'error', what: 'Hours not saved' })
      toast.error('Failed to add availability')
      return
    }
    setSlots((prev) => [...prev, ...inserted])
    setSelectedDays([])
    setSaveState({ kind: 'saved', what: `Hours added to ${label}` })
    const ids = inserted.map((r) => r.id)
    toast.success(`Hours added to ${label}`, {
      action: { label: 'Undo', onClick: () => void undoAdd(ids) },
    })
  }

  async function undoAdd(ids: string[]) {
    setSaveState({ kind: 'saving', what: 'Undoing' })
    if (!(await deleteRows(ids))) {
      setSaveState({ kind: 'error', what: 'Undo failed' })
      toast.error('Couldn’t undo. Remove the hours from the list instead.')
      return
    }
    setSlots((prev) => prev.filter((s) => !ids.includes(s.id)))
    setSaveState({ kind: 'saved', what: 'Undone' })
  }

  /* ── edit (weekly window or block) ── */

  function startEditWindow(slot: AvailabilitySlot) {
    setEditingId(slot.id)
    setBlockDraft(null)
    setWindowDraft({
      day: slot.day_of_week ?? 0,
      start: hhmm(slot.start_time, '08:00'),
      end: hhmm(slot.end_time, '17:00'),
    })
  }

  function startEditBlock(slot: AvailabilitySlot) {
    setEditingId(slot.id)
    setWindowDraft(null)
    setBlockDraft({ start: slot.start_date ?? '', end: slot.end_date ?? '', notes: slot.notes ?? '' })
  }

  function cancelEdit() {
    setEditingId(null)
    setWindowDraft(null)
    setBlockDraft(null)
  }

  async function saveEdit(slot: AvailabilitySlot) {
    let updates: Partial<AvailabilitySlot>
    if (windowDraft) {
      if (windowDraft.start === windowDraft.end) {
        toast.error('Start and end time can’t be the same')
        return
      }
      const others = existingWindows.filter((w) => w.id !== slot.id)
      if (findOverlaps([windowDraft], others).length > 0) {
        toast.error(`Overlaps other hours on ${DAYS_OF_WEEK[windowDraft.day]}.`)
        return
      }
      updates = {
        day_of_week: windowDraft.day,
        start_time: windowDraft.start,
        end_time: windowDraft.end,
        timezone: timeZone,
      }
    } else if (blockDraft) {
      if (!blockDraft.start || !blockDraft.end) {
        toast.error('Pick a start and end date')
        return
      }
      if (blockDraft.end < blockDraft.start) {
        toast.error('End date must be on or after the start date')
        return
      }
      updates = {
        start_date: blockDraft.start,
        end_date: blockDraft.end,
        notes: blockDraft.notes.trim() || null,
        timezone: timeZone,
      }
    } else {
      return
    }

    const previous: Partial<AvailabilitySlot> = Object.fromEntries(
      Object.keys(updates).map((k) => [k, slot[k as keyof AvailabilitySlot] ?? null])
    )
    setSaveState({ kind: 'saving', what: 'Saving changes' })
    if (!(await updateRow(slot.id, updates))) {
      setSaveState({ kind: 'error', what: 'Changes not saved' })
      toast.error('Failed to save. Your change wasn’t saved.')
      return
    }
    setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, ...updates } : s)))
    cancelEdit()
    setSaveState({ kind: 'saved', what: 'Changes saved' })
    toast.success('Changes saved', {
      action: { label: 'Undo', onClick: () => void undoEdit(slot.id, previous) },
    })
  }

  async function undoEdit(id: string, previous: Partial<AvailabilitySlot>) {
    setSaveState({ kind: 'saving', what: 'Undoing' })
    if (!(await updateRow(id, previous))) {
      setSaveState({ kind: 'error', what: 'Undo failed' })
      toast.error('Couldn’t undo that change.')
      return
    }
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...previous } : s)))
    setSaveState({ kind: 'saved', what: 'Undone' })
  }

  /* ── delete ── */

  async function deleteSlot(slot: AvailabilitySlot) {
    setSaveState({ kind: 'saving', what: 'Removing' })
    if (!(await deleteRows([slot.id]))) {
      setSaveState({ kind: 'error', what: 'Not removed' })
      toast.error('Failed to delete')
      return
    }
    if (editingId === slot.id) cancelEdit()
    setSlots((prev) => prev.filter((s) => s.id !== slot.id))
    const what = slot.is_blocked ? 'Block removed' : 'Hours removed'
    setSaveState({ kind: 'saved', what })
    toast.success(what, { action: { label: 'Undo', onClick: () => void undoDelete(slot) } })
  }

  async function undoDelete(slot: AvailabilitySlot) {
    setSaveState({ kind: 'saving', what: 'Restoring' })
    // Re-insert the same row (same id) so nothing else changes.
    const { id, ...rest } = slot
    const restored = await insertRows([{ id, ...rest } as AvailabilitySlot])
    if (!restored) {
      setSaveState({ kind: 'error', what: 'Not restored' })
      toast.error('Couldn’t restore it. Add it again instead.')
      return
    }
    setSlots((prev) => [...prev, ...restored])
    setSaveState({ kind: 'saved', what: 'Restored' })
  }

  /* ── date blocks: add ── */

  function openNewBlock() {
    const today = todayIn(timeZone)
    setNewBlock({ start: today, end: today, notes: '' })
  }

  async function saveNewBlock() {
    if (!newBlock) return
    if (!newBlock.start || !newBlock.end) {
      toast.error('Pick a start and end date')
      return
    }
    if (newBlock.end < newBlock.start) {
      toast.error('End date must be on or after the start date')
      return
    }
    const userId = await currentUserId()
    if (!userId) return
    setSaveState({ kind: 'saving', what: 'Adding block' })
    const inserted = await insertRows([
      {
        contractor_id: userId,
        day_of_week: null,
        start_date: newBlock.start,
        end_date: newBlock.end,
        start_time: null,
        end_time: null,
        is_recurring: false,
        is_blocked: true,
        notes: newBlock.notes.trim() || null,
        timezone: timeZone,
      },
    ])
    if (!inserted) {
      setSaveState({ kind: 'error', what: 'Block not saved' })
      toast.error('Failed to add block')
      return
    }
    setSlots((prev) => [...prev, ...inserted])
    setNewBlock(null)
    setSaveState({ kind: 'saved', what: 'Block added' })
    const ids = inserted.map((r) => r.id)
    toast.success('Block added', { action: { label: 'Undo', onClick: () => void undoAdd(ids) } })
  }

  /* ── render ── */

  const header = (
    <div>
      <h1 className="text-2xl font-bold text-[#1a1a17]">Availability</h1>
      <p className="text-[#5f5d57]">Set your usual weekly working hours and block out time off.</p>
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-[#2f3cf5]" />
        </div>
      </div>
    )
  }

  // Group recurring slots by day for the weekly grid summary
  const slotsByDay = new Map<number, AvailabilitySlot[]>()
  for (const s of recurringSlots) {
    if (s.day_of_week == null) continue
    const list = slotsByDay.get(s.day_of_week) ?? []
    list.push(s)
    slotsByDay.set(s.day_of_week, list)
  }

  const newIsOvernight = !!newStart && !!newEnd && newStart !== newEnd && isOvernight(newStart, newEnd)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {header}
          <Link
            href="/contractor/rates"
            className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-[#2f3cf5] hover:text-[#2330c8]"
          >
            Set your rates <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
        <SaveStatus state={saveState} />
      </div>

      <div className="rounded-lg border border-[#eeebe4] bg-[#faf9f6] p-4 text-sm text-[#5f5d57]">
        Weekly hours tell clients when you generally work. They aren&apos;t bookable appointments: a
        client still sends a request you can accept or decline. Setting hours doesn&apos;t approve or
        publish your profile.
      </div>

      {/* Timezone */}
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="timezone" className="text-sm font-medium text-[#1a1a17]">
          Timezone
        </Label>
        <Select value={timeZone} onValueChange={(v) => v && setTimeZone(v)}>
          <SelectTrigger id="timezone" className="w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {zones.map((z) => (
              <SelectItem key={z} value={z}>
                {z.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-[#706d65]">
          Used for hours you add or save. Times are local clock times, so they stay the same across
          daylight-saving changes.
        </p>
      </div>

      {/* Weekly schedule overview grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#1a1a17]">
            <Calendar className="size-5 text-[#2f3cf5]" />
            Weekly hours
          </CardTitle>
          <CardDescription className="text-[#5f5d57]">
            Your usual working hours for each day of the week. Not the same as booked appointments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add hours to one or more days. Nothing is saved until Add. */}
          <div className="space-y-3 rounded-lg border border-[#eeebe4] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[#1a1a17]">Add hours</h2>
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
            <p className="text-xs text-[#706d65]">
              {newIsOvernight ? 'Ends the next day. ' : ''}
              Saved in {timeZone.replace(/_/g, ' ')}. Nothing is saved until you press Add.
            </p>
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
                        <div key={s.id} className="text-xs text-[#2330c8]">
                          {hhmm(s.start_time, '—')}–{hhmm(s.end_time, '—')}
                          {s.start_time && s.end_time && isOvernight(hhmm(s.start_time), hhmm(s.end_time))
                            ? ' (+1)'
                            : ''}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-[#5f5d57]">No hours</div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Weekly hours list: read-only rows with Edit; Save / Cancel per row. */}
          {recurringSlots.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#eeebe4] py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-[#eceefe]">
                <Calendar className="size-6 text-[#2f3cf5]" />
              </div>
              <h3 className="mt-3 text-lg font-semibold text-[#1a1a17]">
                No weekly hours yet
              </h3>
              <p className="mt-1 text-sm text-[#5f5d57]">
                Pick one or more days above and add your hours.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-[#1a1a17]">Your weekly hours</h2>
              <div className="divide-y divide-[#eeebe4] rounded-lg border border-[#eeebe4]">
                {recurringSlots.map((slot) => {
                  const editing = editingId === slot.id && windowDraft
                  if (editing) {
                    return (
                      <div key={slot.id} className="flex flex-wrap items-center gap-3 bg-[#faf9f6] px-4 py-3">
                        <Select
                          value={String(windowDraft.day)}
                          onValueChange={(v) => setWindowDraft({ ...windowDraft, day: parseInt(v ?? '0', 10) })}
                        >
                          <SelectTrigger className="w-36" aria-label="Day">
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
                          <Input
                            type="time"
                            aria-label="Start"
                            value={windowDraft.start}
                            onChange={(e) => setWindowDraft({ ...windowDraft, start: e.target.value })}
                            className="w-32"
                          />
                          <span className="text-sm text-[#5f5d57]">to</span>
                          <Input
                            type="time"
                            aria-label="End"
                            value={windowDraft.end}
                            onChange={(e) => setWindowDraft({ ...windowDraft, end: e.target.value })}
                            className="w-32"
                          />
                        </div>
                        <span className="text-xs text-[#706d65]">
                          {windowDraft.start !== windowDraft.end && isOvernight(windowDraft.start, windowDraft.end)
                            ? 'Ends the next day · '
                            : ''}
                          {timeZone.replace(/_/g, ' ')}
                        </span>
                        <div className="ml-auto flex gap-2">
                          <Button variant="outline" size="sm" onClick={cancelEdit} disabled={saving}>
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => void saveEdit(slot)}
                            disabled={saving}
                            className="bg-[#2f3cf5] text-white hover:bg-[#2330c8]"
                          >
                            {saving ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
                          </Button>
                        </div>
                      </div>
                    )
                  }
                  const overnight =
                    !!slot.start_time && !!slot.end_time && isOvernight(hhmm(slot.start_time), hhmm(slot.end_time))
                  return (
                    <div key={slot.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <span className="w-28 text-sm font-medium text-[#1a1a17]">
                        {DAYS_OF_WEEK[slot.day_of_week ?? 0]}
                      </span>
                      <span className="text-sm text-[#1a1a17]">
                        {hhmm(slot.start_time, '—')}–{hhmm(slot.end_time, '—')}
                        {overnight ? ' (next day)' : ''}
                      </span>
                      <span className="text-xs text-[#706d65]">
                        {slot.timezone ? slot.timezone.replace(/_/g, ' ') : 'Timezone not set'}
                      </span>
                      <Badge variant="outline" className="border-[#c9cdfb] bg-[#eceefe] text-[#2330c8]">
                        Working hours
                      </Badge>
                      <div className="ml-auto flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => startEditWindow(slot)}
                          disabled={saving || (editingId !== null && editingId !== slot.id)}
                          aria-label="Edit hours"
                        >
                          <Pencil className="size-4 text-[#5f5d57]" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void deleteSlot(slot)}
                          disabled={saving}
                          aria-label="Remove hours"
                        >
                          <Trash2 className="size-4 text-[#5f5d57]" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
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
            {!newBlock && (
              <Button variant="outline" onClick={openNewBlock} disabled={saving}>
                <Plus className="size-4 mr-2" />
                Add block
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {newBlock && (
            <BlockEditor
              draft={newBlock}
              onChange={setNewBlock}
              onCancel={() => setNewBlock(null)}
              onSave={() => void saveNewBlock()}
              saving={saving}
              timeZone={timeZone}
              saveLabel="Save block"
            />
          )}
          {blockedSlots.length === 0 && !newBlock ? (
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
              {blockedSlots.map((slot) =>
                editingId === slot.id && blockDraft ? (
                  <div key={slot.id} className="py-3">
                    <BlockEditor
                      draft={blockDraft}
                      onChange={setBlockDraft}
                      onCancel={cancelEdit}
                      onSave={() => void saveEdit(slot)}
                      saving={saving}
                      timeZone={timeZone}
                      saveLabel="Save"
                    />
                  </div>
                ) : (
                  <div
                    key={slot.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 last:border-0"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-sm text-[#1a1a17]">
                      <span className="font-medium">
                        {slot.start_date ?? '—'}
                        {slot.end_date && slot.end_date !== slot.start_date ? ` to ${slot.end_date}` : ''}
                      </span>
                      {slot.notes && <span className="text-[#5f5d57]">· {slot.notes}</span>}
                      {slot.timezone && (
                        <span className="text-xs text-[#706d65]">{slot.timezone.replace(/_/g, ' ')}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="border-[#f4c7c2] bg-[#fdecea] text-[#b42318]">
                        Blocked
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => startEditBlock(slot)}
                        disabled={saving || (editingId !== null && editingId !== slot.id)}
                        aria-label="Edit block"
                      >
                        <Pencil className="size-4 text-[#5f5d57]" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void deleteSlot(slot)}
                        disabled={saving}
                        aria-label="Remove block"
                      >
                        <Trash2 className="size-4 text-[#5f5d57]" />
                      </Button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function BlockEditor({
  draft,
  onChange,
  onCancel,
  onSave,
  saving,
  timeZone,
  saveLabel,
}: {
  draft: BlockDraft
  onChange: (d: BlockDraft) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
  timeZone: string
  saveLabel: string
}) {
  return (
    <div className="space-y-2 rounded-lg border border-[#eeebe4] bg-[#faf9f6] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="date"
          aria-label="First blocked date"
          value={draft.start}
          onChange={(e) => onChange({ ...draft, start: e.target.value })}
          className="w-40"
        />
        <span className="text-sm text-[#5f5d57]">to</span>
        <Input
          type="date"
          aria-label="Last blocked date"
          value={draft.end}
          min={draft.start || undefined}
          onChange={(e) => onChange({ ...draft, end: e.target.value })}
          className="w-40"
        />
        <Input
          placeholder="Reason (optional, e.g. Vacation)"
          aria-label="Reason"
          value={draft.notes}
          maxLength={200}
          onChange={(e) => onChange({ ...draft, notes: e.target.value })}
          className="w-56"
        />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={saving}
            className="bg-[#2f3cf5] text-white hover:bg-[#2330c8]"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : saveLabel}
          </Button>
        </div>
      </div>
      <p className="text-xs text-[#706d65]">
        Whole days in {timeZone.replace(/_/g, ' ')}. Reasons are for you; don&apos;t include health
        details. Nothing is saved until you press {saveLabel}.
      </p>
    </div>
  )
}

function SaveStatus({ state }: { state: SaveState }) {
  return (
    <p role="status" aria-live="polite" className="flex min-h-5 items-center gap-1.5 text-sm">
      {state.kind === 'saving' && (
        <span className="inline-flex items-center gap-1.5 text-[#5f5d57]">
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> {state.what}…
        </span>
      )}
      {state.kind === 'saved' && (
        <span className="inline-flex items-center gap-1.5 text-[#2330c8]">
          <Check className="size-3.5" aria-hidden /> Saved · {state.what}
        </span>
      )}
      {state.kind === 'error' && (
        <span className="inline-flex items-center gap-1.5 text-[#b42318]">
          <AlertCircle className="size-3.5" aria-hidden /> Not saved · {state.what}
        </span>
      )}
    </p>
  )
}
