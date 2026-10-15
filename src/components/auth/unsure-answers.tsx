'use client'

import { Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { US_STATES } from '@/lib/utils/constants'
import {
  UNSURE_CREDENTIALS,
  UNSURE_TEAM_SIZES,
  UNSURE_WANTS,
  UNSURE_WHAT_YOU_DO_MAX,
} from '@/lib/onboarding/signup-path'

/**
 * Step 2 of the Not sure signup ("Tell us about you"). Shared by
 * /signup/unsure (email) and /onboarding/unsure (Google). The server
 * validates the same rules in src/lib/onboarding/unsure.ts.
 */
export interface UnsureAnswersDraft {
  what_you_do: string
  team_size: string
  has_location: '' | 'yes' | 'no'
  credential: string
  website: string
  wants: string[]
  city: string
  state: string
}

export const EMPTY_UNSURE_ANSWERS: UnsureAnswersDraft = {
  what_you_do: '',
  team_size: '',
  has_location: '',
  credential: '',
  website: '',
  wants: [],
  city: '',
  state: '',
}

export function unsureAnswersComplete(d: UnsureAnswersDraft): boolean {
  return (
    d.what_you_do.trim().length > 0 &&
    d.what_you_do.trim().length <= UNSURE_WHAT_YOU_DO_MAX &&
    d.team_size !== '' &&
    d.has_location !== '' &&
    d.credential !== '' &&
    d.wants.length > 0 &&
    d.city.trim().length > 0 &&
    d.state !== ''
  )
}

/** JSON body shape the server expects (see unsureAnswersSchema). */
export function unsureAnswersPayload(d: UnsureAnswersDraft) {
  return {
    what_you_do: d.what_you_do.trim(),
    team_size: d.team_size,
    has_location: d.has_location === 'yes',
    credential: d.credential,
    ...(d.website.trim() ? { website: d.website.trim() } : {}),
    wants: d.wants,
    city: d.city.trim(),
    state: d.state,
  }
}

export function UnsureAnswersFields({
  value,
  onChange,
}: {
  value: UnsureAnswersDraft
  onChange: (next: UnsureAnswersDraft) => void
}) {
  const set = <K extends keyof UnsureAnswersDraft>(key: K, v: UnsureAnswersDraft[K]) =>
    onChange({ ...value, [key]: v })

  function toggleWant(key: string) {
    set(
      'wants',
      value.wants.includes(key) ? value.wants.filter((w) => w !== key) : [...value.wants, key]
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="what-you-do" className="text-sm font-semibold text-[#404145]">
          What do you do?
        </Label>
        <Input
          id="what-you-do"
          value={value.what_you_do}
          onChange={(e) => set('what_you_do', e.target.value)}
          placeholder="Nurse practitioner running a mobile IV business"
          maxLength={UNSURE_WHAT_YOU_DO_MAX}
          className="h-11"
        />
      </div>

      <ChoiceGroup
        label="Do you work alone or with a team?"
        options={UNSURE_TEAM_SIZES}
        value={value.team_size}
        onChange={(v) => set('team_size', v)}
      />

      <ChoiceGroup
        label="Do you have a physical location where you see clients?"
        options={[
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ]}
        value={value.has_location}
        onChange={(v) => set('has_location', v as 'yes' | 'no')}
      />

      <ChoiceGroup
        label="Do you hold a state license or professional certification?"
        options={UNSURE_CREDENTIALS}
        value={value.credential}
        onChange={(v) => set('credential', v)}
      />

      <div className="space-y-1.5">
        <Label htmlFor="website" className="text-sm font-semibold text-[#404145]">
          Website or LinkedIn <span className="font-normal text-[#62646a]">(optional)</span>
        </Label>
        <Input
          id="website"
          // Plain text: type="url" would reject "linkedin.com/in/…" without https://.
          type="text"
          inputMode="url"
          value={value.website}
          onChange={(e) => set('website', e.target.value)}
          placeholder="linkedin.com/in/yourname"
          maxLength={300}
          className="h-11"
        />
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-[#404145]">
          What do you want to do on Sanus?{' '}
          <span className="font-normal text-[#62646a]">Pick any</span>
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {UNSURE_WANTS.map((w) => {
            const active = value.wants.includes(w.value)
            return (
              <button
                key={w.value}
                type="button"
                aria-pressed={active}
                onClick={() => toggleWant(w.value)}
                className={`flex items-center gap-2 rounded-xl border px-3.5 py-3 text-left text-sm font-semibold transition ${
                  active
                    ? 'border-[#1dbf73] bg-[#e8faf1] text-[#404145]'
                    : 'border-[#e4e5e7] bg-white text-[#404145] hover:border-[#bcebd5] hover:bg-[#fafefb]'
                }`}
              >
                <span className="flex-1">{w.label}</span>
                {active && <Check className="size-4 shrink-0 text-[#0f8f56]" />}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div>
        <p className="text-sm font-semibold text-[#404145]">Where are you based?</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_160px]">
          <div className="space-y-1.5">
            <Label htmlFor="unsure-city" className="text-sm font-semibold text-[#404145]">
              City
            </Label>
            <Input
              id="unsure-city"
              value={value.city}
              onChange={(e) => set('city', e.target.value)}
              placeholder="e.g., Los Angeles"
              autoComplete="address-level2"
              maxLength={100}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="unsure-state" className="text-sm font-semibold text-[#404145]">
              State
            </Label>
            <Select value={value.state} onValueChange={(v) => set('state', v ?? '')}>
              <SelectTrigger id="unsure-state" className="h-11 w-full">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label} ({s.value})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChoiceGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-[#404145]">{label}</legend>
      <div role="radiogroup" className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                active
                  ? 'border-[#1dbf73] bg-[#e8faf1] text-[#0f8f56]'
                  : 'border-[#e4e5e7] bg-white text-[#404145] hover:border-[#bcebd5]'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
