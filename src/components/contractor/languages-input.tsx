'use client'

import { useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  COMMON_LANGUAGES,
  MAX_LANGUAGES,
  MAX_LANGUAGE_LENGTH,
  normalizeLanguages,
} from '@/lib/profile/languages'

/**
 * Multi-select chips for the languages a professional works in, plus a
 * free-text "add another" for anything not in the quick-pick list.
 */
export function LanguagesInput({
  value,
  onChange,
  id = 'languages',
}: {
  value: string[]
  onChange: (next: string[]) => void
  id?: string
}) {
  const [draft, setDraft] = useState('')
  const selected = new Set(value.map((v) => v.toLowerCase()))
  const custom = value.filter(
    (v) => !COMMON_LANGUAGES.some((c) => c.toLowerCase() === v.toLowerCase())
  )
  const atLimit = value.length >= MAX_LANGUAGES

  function toggle(language: string) {
    if (selected.has(language.toLowerCase())) {
      onChange(value.filter((v) => v.toLowerCase() !== language.toLowerCase()))
    } else if (!atLimit) {
      onChange(normalizeLanguages([...value, language]))
    }
  }

  function addDraft() {
    const next = normalizeLanguages([...value, draft])
    onChange(next)
    setDraft('')
  }

  const chipBase =
    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1dbf73]/40'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${id}-label`}>
        {COMMON_LANGUAGES.map((language) => {
          const isOn = selected.has(language.toLowerCase())
          return (
            <button
              key={language}
              type="button"
              aria-pressed={isOn}
              disabled={!isOn && atLimit}
              onClick={() => toggle(language)}
              className={`${chipBase} ${
                isOn
                  ? 'border-[#1dbf73] bg-[#e8faf1] font-medium text-[#0f8f56]'
                  : 'border-[#e4e5e7] bg-white text-[#62646a] hover:border-[#c5c6c9] disabled:opacity-50'
              }`}
            >
              {isOn && <Check className="size-3.5" />}
              {language}
            </button>
          )
        })}
        {custom.map((language) => (
          <button
            key={language}
            type="button"
            aria-pressed
            onClick={() => toggle(language)}
            className={`${chipBase} border-[#1dbf73] bg-[#e8faf1] font-medium text-[#0f8f56]`}
          >
            {language}
            <X className="size-3.5" aria-label={`Remove ${language}`} />
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          maxLength={MAX_LANGUAGE_LENGTH}
          disabled={atLimit}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (draft.trim()) addDraft()
            }
          }}
          placeholder="Add another language"
        />
        <Button
          type="button"
          variant="outline"
          onClick={addDraft}
          disabled={!draft.trim() || atLimit}
        >
          <Plus className="size-4" data-icon="inline-start" />
          Add
        </Button>
      </div>
    </div>
  )
}
