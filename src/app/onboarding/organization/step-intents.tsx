'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ORG_INTENTS, type OrgIntent } from '@/lib/onboarding/organization'
import { FieldError, PRIMARY_BTN, StepHeading } from '../professional/ui'
import { saveIntents } from './actions'

export function StepIntents({
  value,
  onChange,
  onBack,
  onDone,
}: {
  value: OrgIntent[]
  onChange: (v: OrgIntent[]) => void
  onBack: () => void
  onDone: () => void
}) {
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  function toggle(key: OrgIntent) {
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key])
    setError(undefined)
  }

  async function submit() {
    setSaving(true)
    const res = await saveIntents(value)
    if (!res.ok) {
      setSaving(false)
      setError(res.error)
      toast.error(res.error)
      return
    }
    setSaving(false)
    onDone()
  }

  return (
    <div className="space-y-6">
      <StepHeading title="What do you want to do on Sanus?" sub="Pick any. You can change this anytime." />

      <div className="grid gap-3">
        {ORG_INTENTS.map((intent) => {
          const on = value.includes(intent.key)
          return (
            <button
              key={intent.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(intent.key)}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                on ? 'border-[#1dbf73] bg-[#e8faf1]' : 'border-[#e4e5e7] bg-white hover:border-[#bcebd5]'
              }`}
            >
              <span
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border ${
                  on ? 'border-[#1dbf73] bg-[#1dbf73] text-white' : 'border-[#c5c6c9] bg-white'
                }`}
              >
                {on && <Check className="size-3.5" />}
              </span>
              <span>
                <span className="block text-sm font-semibold text-[#404145]">{intent.label}</span>
                <span className="block text-sm text-[#62646a]">{intent.sub}</span>
              </span>
            </button>
          )
        })}
      </div>
      <FieldError msg={error} />

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack} className="h-11">
          Back
        </Button>
        <Button type="button" onClick={submit} disabled={saving} className={PRIMARY_BTN}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Continue
        </Button>
      </div>
    </div>
  )
}
