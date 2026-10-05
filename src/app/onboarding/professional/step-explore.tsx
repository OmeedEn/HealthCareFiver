'use client'

import { useState } from 'react'
import { Check, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PRIMARY_BTN, StepHeading, TextField } from './ui'
import { saveExplore, skipExplore } from './actions'
import { EXPLORE_INTERESTS, INTEREST_TILES, LANGUAGE_SUGGESTIONS, type ExploreData } from './shared'

/**
 * Step 6: "Want to explore Sanus too?" One account, two modes — professionals
 * can browse, book and learn as a client. Everything here is optional.
 */
export function StepExplore({
  initial,
  onBack,
  onDone,
}: {
  initial: ExploreData
  onBack: () => void
  onDone: () => void
}) {
  const [v, setV] = useState<ExploreData>(initial)
  const [busy, setBusy] = useState<'save' | 'skip' | null>(null)
  const [customLang, setCustomLang] = useState('')
  const toggle = (k: 'interests' | 'tiles' | 'languages', value: string) =>
    setV((cur) => ({
      ...cur,
      [k]: cur[k].includes(value) ? cur[k].filter((x) => x !== value) : [...cur[k], value],
    }))

  async function run(kind: 'save' | 'skip') {
    setBusy(kind)
    const res = kind === 'save' ? await saveExplore(v) : await skipExplore()
    if (!res.ok) {
      setBusy(null)
      toast.error(res.error)
      return
    }
    onDone()
  }

  const languages = Array.from(new Set([...LANGUAGE_SUGGESTIONS, ...v.languages]))

  return (
    <div className="space-y-7">
      <StepHeading
        title="Want to explore Sanus too?"
        sub="You can use Sanus as a client too: browse, book, and learn from other professionals."
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-[#404145]">What are you interested in? (pick any)</legend>
        <div className="grid gap-2">
          {EXPLORE_INTERESTS.map((i) => {
            const on = v.interests.includes(i.value)
            return (
              <button
                key={i.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggle('interests', i.value)}
                className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
                  on ? 'border-[#1dbf73] bg-[#e8faf1]' : 'border-[#e4e5e7] bg-white hover:border-[#bcebd5]'
                }`}
              >
                <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border ${on ? 'border-[#1dbf73] bg-[#1dbf73] text-white' : 'border-[#c5c6c9]'}`}>
                  {on && <Check className="size-3" />}
                </span>
                <span>
                  <span className="block text-sm font-medium text-[#404145]">{i.label}</span>
                  {i.sub && <span className="block text-xs text-[#62646a]">{i.sub}</span>}
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-[#404145]">
          Personalize what you see <span className="font-normal text-[#95979d]">(optional)</span>
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {INTEREST_TILES.map((t) => {
            const on = v.tiles.includes(t.value)
            return (
              <button
                key={t.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggle('tiles', t.value)}
                className={`rounded-lg border px-3 py-3 text-sm font-medium transition ${
                  on ? 'border-[#1dbf73] bg-[#e8faf1] text-[#0f8f56]' : 'border-[#e4e5e7] bg-white text-[#404145] hover:border-[#bcebd5]'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="max-w-sm">
        <TextField
          id="explore-location"
          label="Your location"
          optional
          hint="City or ZIP, so in-person results are nearby."
          value={v.location}
          onChange={(x) => setV({ ...v, location: x })}
          maxLength={100}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-[#404145]">
          Languages you speak <span className="font-normal text-[#95979d]">(also shown on your provider profile)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {languages.map((l) => {
            const on = v.languages.includes(l)
            return (
              <button
                key={l}
                type="button"
                aria-pressed={on}
                onClick={() => toggle('languages', l)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  on ? 'border-[#1dbf73] bg-[#e8faf1] text-[#0f8f56]' : 'border-[#e4e5e7] bg-white text-[#62646a] hover:border-[#bcebd5]'
                }`}
              >
                {on && <Check className="size-3" />}
                {l}
              </button>
            )
          })}
        </div>
        <div className="flex max-w-xs items-center gap-2">
          <input
            aria-label="Add another language"
            placeholder="Another language"
            value={customLang}
            maxLength={40}
            onChange={(e) => setCustomLang(e.target.value)}
            className="h-9 flex-1 rounded-lg border border-input bg-white px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              const l = customLang.trim()
              if (l && !v.languages.includes(l)) setV({ ...v, languages: [...v.languages, l] })
              setCustomLang('')
            }}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#1dbf73]"
          >
            <Plus className="size-4" /> Add
          </button>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="h-11" disabled={busy !== null}>
          Back
        </Button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => run('skip')}
            disabled={busy !== null}
            className="text-sm font-semibold text-[#62646a] hover:text-[#404145]"
          >
            {busy === 'skip' ? 'Finishing…' : 'Skip — I’ll browse on my own'}
          </button>
          <Button type="button" onClick={() => run('save')} disabled={busy !== null} className={PRIMARY_BTN}>
            {busy === 'save' && <Loader2 className="mr-2 size-4 animate-spin" />}
            Finish
          </Button>
        </div>
      </div>
    </div>
  )
}
