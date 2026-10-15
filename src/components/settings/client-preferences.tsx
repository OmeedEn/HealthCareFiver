'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/data'
import {
  CLIENT_INTERESTS,
  HELP_TIMELINES,
  MEETING_FORMATS,
  normalizeClientInterests,
} from '@/lib/onboarding/client-interests'
import { OptionChips } from '@/components/onboarding/choices'
import { US_STATES } from '@/lib/utils/constants'
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
import { toast } from 'sonner'
import { Check, Loader2 } from 'lucide-react'

// Mirrors the client branch of /api/auth/signup and the client_profiles
// CHECK constraints so a save never fails on the DB side.
const MAX_INTERESTS = CLIENT_INTERESTS.length
const MAX_CITY_LENGTH = 100
const STATE_RE = /^[A-Z]{2}$/
const ZIP_RE = /^\d{5}$/

/**
 * Lets a client edit the interests and location they picked at signup.
 * Self-contained: it looks up the signed-in user's role and renders nothing
 * for non-clients (and in demo mode, which has no client persona).
 */
export function ClientPreferences() {
  const [status, setStatus] = useState<'loading' | 'hidden' | 'ready'>(
    'loading'
  )
  const [userId, setUserId] = useState<string | null>(null)
  const [interests, setInterests] = useState<string[]>([])
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [timeline, setTimeline] = useState('')
  const [formats, setFormats] = useState<string[]>([])
  // False until migration 20261016000400 adds timeline/format columns.
  const [hasAnswerColumns, setHasAnswerColumns] = useState(false)
  const [saving, setSaving] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (isDemoMode()) {
        setStatus('hidden')
        return
      }
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setStatus('hidden')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.role !== 'client') {
        if (!cancelled) setStatus('hidden')
        return
      }
      const base = 'interests, city, state, zip_code'
      let withAnswers = true
      let { data: row, error } = await supabase
        .from('client_profiles')
        .select(`${base}, help_timeline, meeting_formats`)
        .eq('id', user.id)
        .maybeSingle()
      if (error) {
        withAnswers = false
        ;({ data: row, error } = await supabase
          .from('client_profiles')
          .select(base)
          .eq('id', user.id)
          .maybeSingle())
      }
      if (cancelled) return
      if (error || !row) {
        // No row to update (RLS has no client-side INSERT), so don't offer
        // an editor that can't save.
        setStatus('hidden')
        return
      }
      setUserId(user.id)
      const r = row as Record<string, unknown>
      setInterests(
        Array.isArray(r.interests) ? normalizeClientInterests(r.interests as string[]) : []
      )
      setHasAnswerColumns(withAnswers)
      setTimeline(typeof r.help_timeline === 'string' ? r.help_timeline : '')
      setFormats(Array.isArray(r.meeting_formats) ? (r.meeting_formats as string[]) : [])
      setCity((r.city as string | null) ?? '')
      setState((r.state as string | null) ?? '')
      setZip((r.zip_code as string | null) ?? '')
      setStatus('ready')
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // The dashboard links here as /settings#preferences; the card mounts after
  // an async load, so the browser's own hash scroll misses it.
  useEffect(() => {
    if (status === 'ready' && window.location.hash === '#preferences') {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [status])

  if (status !== 'ready') return null

  function toggle(key: string) {
    setInterests((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : prev.length >= MAX_INTERESTS
          ? prev
          : [...prev, key]
    )
  }

  async function handleSave() {
    const trimmedCity = city.trim()
    const trimmedZip = zip.trim()
    if (interests.length === 0) {
      toast.error('Pick at least one thing you are looking for.')
      return
    }
    if (trimmedCity.length > MAX_CITY_LENGTH) {
      toast.error(`City must be ${MAX_CITY_LENGTH} characters or fewer.`)
      return
    }
    if (state && !STATE_RE.test(state)) {
      toast.error('Select a valid state.')
      return
    }
    if (trimmedZip && !ZIP_RE.test(trimmedZip)) {
      toast.error('Enter a 5-digit ZIP code.')
      return
    }
    if (!userId) return

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('client_profiles')
      .update({
        interests,
        city: trimmedCity || null,
        state: state || null,
        zip_code: trimmedZip || null,
        ...(hasAnswerColumns
          ? { help_timeline: timeline || null, meeting_formats: formats }
          : {}),
      })
      .eq('id', userId)
    setSaving(false)

    if (error) {
      toast.error('Could not save your preferences. Please try again.')
      return
    }
    toast.success('Preferences saved')
  }

  return (
    <Card id="preferences" ref={cardRef} className="scroll-mt-6">
      <CardHeader>
        <CardTitle>What you&apos;re looking for</CardTitle>
        <CardDescription>
          We use these to suggest professionals near you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <fieldset>
          <legend className="sr-only">Interests</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {CLIENT_INTERESTS.map((item) => {
              const selected = interests.includes(item.key)
              return (
                <button
                  key={item.key}
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  onClick={() => toggle(item.key)}
                  className={`flex items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1dbf73]/50 ${
                    selected
                      ? 'border-[#1dbf73] bg-[#e8faf1]'
                      : 'border-[#e4e5e7] hover:border-[#c5c6c9]'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border ${
                      selected
                        ? 'border-[#1dbf73] bg-[#1dbf73] text-white'
                        : 'border-[#c5c6c9]'
                    }`}
                    aria-hidden="true"
                  >
                    {selected && <Check className="size-3" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[#404145]">
                      {item.label}
                    </span>
                    <span className="block text-xs text-[#62646a]">
                      {item.sub}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>

        {hasAnswerColumns && (
          <div className="space-y-4">
            <OptionChips
              legend="How soon do you need help?"
              options={HELP_TIMELINES}
              value={timeline ? [timeline] : []}
              onChange={(v) => setTimeline(v.find((x) => x !== timeline) ?? '')}
            />
            <OptionChips
              legend="How would you like to meet?"
              options={MEETING_FORMATS}
              value={formats}
              onChange={(v) => {
                const added = v.find((x) => !formats.includes(x))
                setFormats(
                  added === 'no_preference'
                    ? ['no_preference']
                    : added
                      ? v.filter((x) => x !== 'no_preference')
                      : v
                )
              }}
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="client-city">City</Label>
            <Input
              id="client-city"
              value={city}
              maxLength={MAX_CITY_LENGTH}
              onChange={(e) => setCity(e.target.value)}
              autoComplete="address-level2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-state">State</Label>
            <select
              id="client-state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              autoComplete="address-level1"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">—</option>
              {US_STATES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-zip">ZIP code</Label>
            <Input
              id="client-zip"
              value={zip}
              inputMode="numeric"
              maxLength={5}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))}
              autoComplete="postal-code"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving || interests.length === 0}
            className="bg-[#1dbf73] text-white hover:bg-[#19a463]"
          >
            {saving && (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            )}
            Save preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
