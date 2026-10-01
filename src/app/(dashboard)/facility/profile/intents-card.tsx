'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ORG_INTENTS, type OrgIntent } from '@/lib/onboarding/organization'
import { updateOrgIntents } from './intents-actions'

/** "What do you want to do on Sanus?" — editable any time after onboarding. */
export function OrgIntentsCard({ initial }: { initial: OrgIntent[] }) {
  const [value, setValue] = useState<OrgIntent[]>(initial)
  const [saving, setSaving] = useState(false)
  const dirty = value.length !== initial.length || value.some((v) => !initial.includes(v))

  async function save() {
    setSaving(true)
    const res = await updateOrgIntents(value)
    setSaving(false)
    if (!res.ok) toast.error(res.error ?? 'Could not save')
    else toast.success('Saved')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">What you want to do on Sanus</CardTitle>
        <CardDescription>Pick any. This shapes your dashboard and what we suggest.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          {ORG_INTENTS.map((i) => {
            const on = value.includes(i.key)
            return (
              <button
                key={i.key}
                type="button"
                aria-pressed={on}
                onClick={() => setValue(on ? value.filter((k) => k !== i.key) : [...value, i.key])}
                className={`flex items-start gap-2 rounded-lg border p-3 text-left text-sm transition ${
                  on ? 'border-[#1dbf73] bg-[#e8faf1]' : 'border-[#e4e5e7] hover:border-[#bcebd5]'
                }`}
              >
                <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border ${on ? 'border-[#1dbf73] bg-[#1dbf73] text-white' : 'border-[#c5c6c9]'}`}>
                  {on && <Check className="size-3" />}
                </span>
                <span className="font-medium text-[#404145]">{i.label}</span>
              </button>
            )
          })}
        </div>
        <Button
          type="button"
          onClick={save}
          disabled={!dirty || value.length === 0 || saving}
          className="bg-[#1dbf73] text-white hover:bg-[#19a463]"
        >
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save
        </Button>
      </CardContent>
    </Card>
  )
}
