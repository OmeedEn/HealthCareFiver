'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  ArrowRight,
  Briefcase,
  GraduationCap,
  Heart,
  Loader2,
  Sparkles,
  Stethoscope,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { saveCategory } from './actions'
import {
  CATEGORY_OPTIONS,
  CREDENTIAL_BASIS_OPTIONS,
  OTHER_PROFESSION_MAX,
  type CredentialBasis,
  type ProCategory,
} from './shared'
import { PRIMARY_BTN, RadioCards, StepHeading, TextField } from './ui'

const ICONS: Record<ProCategory, React.ElementType> = {
  clinical: Stethoscope,
  allied: Heart,
  consultant: Briefcase,
  educator: GraduationCap,
  other: Sparkles,
}

export interface CategoryValue {
  category: ProCategory
  otherProfession: string
  credentialBasis: CredentialBasis | null
}

export function StepCategory({
  initial,
  initialOtherProfession,
  initialCredentialBasis,
  onSaved,
}: {
  initial: ProCategory | null
  initialOtherProfession: string
  initialCredentialBasis: CredentialBasis | null
  onSaved: (v: CategoryValue) => void
}) {
  const [selected, setSelected] = useState<ProCategory | null>(initial)
  const [otherProfession, setOtherProfession] = useState(initialOtherProfession)
  const [basis, setBasis] = useState<CredentialBasis | ''>(initialCredentialBasis ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  const isOther = selected === 'other'
  const canContinue =
    !!selected && (!isOther || (otherProfession.trim().length > 0 && basis !== ''))

  function submit() {
    if (!selected) return
    if (isOther) {
      const fe: Record<string, string> = {}
      if (!otherProfession.trim()) fe.other_profession = 'Tell us your profession'
      if (!basis) fe.credential_basis = 'Choose an option'
      if (Object.keys(fe).length) {
        setErrors(fe)
        return
      }
    }
    startTransition(async () => {
      const res = await saveCategory({
        category: selected,
        other_profession: isOther ? otherProfession.trim() : '',
        credential_basis: isOther ? basis : '',
      })
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {})
        toast.error(res.error)
        return
      }
      setErrors({})
      onSaved({
        category: selected,
        otherProfession: isOther ? otherProfession.trim() : '',
        credentialBasis: isOther && basis ? basis : null,
      })
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
                c.key === 'other' ? 'sm:col-span-2' : ''
              } ${
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

      {isOther && (
        <div className="mt-6 space-y-4 rounded-xl border border-[#e4e5e7] bg-[#fafafa] p-4">
          <TextField
            id="other_profession"
            label="What's your profession?"
            value={otherProfession}
            onChange={(x) => {
              setOtherProfession(x.slice(0, OTHER_PROFESSION_MAX))
              if (errors.other_profession) setErrors((e) => ({ ...e, other_profession: '' }))
            }}
            error={errors.other_profession}
            maxLength={OTHER_PROFESSION_MAX}
            placeholder="e.g., Midwife, Art therapist, Health coach"
          />
          <RadioCards
            name="credential_basis"
            legend="Do you hold a state license or professional certification?"
            options={CREDENTIAL_BASIS_OPTIONS}
            value={basis}
            onChange={(x) => {
              setBasis(x)
              if (errors.credential_basis) setErrors((e) => ({ ...e, credential_basis: '' }))
            }}
            error={errors.credential_basis}
          />
        </div>
      )}

      <Button
        type="button"
        disabled={!canContinue || pending}
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
