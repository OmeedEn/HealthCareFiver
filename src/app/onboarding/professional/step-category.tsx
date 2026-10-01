'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Briefcase, GraduationCap, Heart, Loader2, Stethoscope } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { saveCategory } from './actions'
import { CATEGORY_OPTIONS, type ProCategory } from './shared'
import { PRIMARY_BTN, StepHeading } from './ui'

const ICONS: Record<ProCategory, React.ElementType> = {
  clinical: Stethoscope,
  allied: Heart,
  consultant: Briefcase,
  educator: GraduationCap,
}

export function StepCategory({
  initial,
  onSaved,
}: {
  initial: ProCategory | null
  onSaved: (c: ProCategory) => void
}) {
  const [selected, setSelected] = useState<ProCategory | null>(initial)
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!selected) return
    startTransition(async () => {
      const res = await saveCategory(selected)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      onSaved(selected)
    })
  }

  return (
    <div>
      <StepHeading
        title="What kind of professional are you?"
        sub="Pick the one that best describes your primary work."
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Professional category">
        {CATEGORY_OPTIONS.map((c) => {
          const Icon = ICONS[c.key]
          const active = selected === c.key
          return (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(c.key)}
              className={`flex h-full items-start gap-3 rounded-xl border p-4 text-left transition ${
                active
                  ? 'border-[#1dbf73] bg-[#e8faf1]'
                  : 'border-[#e4e5e7] bg-white hover:border-[#bcebd5] hover:bg-[#fafefb]'
              }`}
            >
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                  active ? 'bg-[#1dbf73] text-white' : 'bg-[#f7f7f7] text-[#62646a]'
                }`}
              >
                <Icon className="size-5" />
              </div>
              <p className="text-sm font-semibold leading-snug text-[#404145]">{c.label}</p>
            </button>
          )
        })}
      </div>

      <Button
        type="button"
        disabled={!selected || pending}
        onClick={submit}
        className={`mt-6 w-full ${PRIMARY_BTN}`}
      >
        {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
        Continue
        <ArrowRight className="ml-2 size-4" />
      </Button>
    </div>
  )
}
