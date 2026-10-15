'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { QuestionFlow, SINGLE_STEP, type Screen } from '@/components/onboarding/question-flow'
import { IconChoices } from '@/components/onboarding/choices'
import { YES_NO_ICONS } from '@/components/onboarding/choice-icons'
import { DocumentUpload } from '@/components/onboarding/professional/document-upload'
import { TextField } from '@/app/onboarding/professional/ui'
import { isUsableDoc, slotMatches, type UploadedDoc } from '@/app/onboarding/professional/shared'
import { COMMON_LANGUAGES } from '@/lib/profile/languages'
import { US_STATES } from '@/lib/utils/constants'
import { formatUsPhoneInput, normalizeUsPhone } from '@/lib/phone'
import { PRO_COPY, normalizeWebsiteUrl } from '@/lib/onboarding/questions/professional'
import type { ProFinishItem } from '@/lib/onboarding/checklist-professional'
import type { ProfessionalBranch } from '@/lib/onboarding/professional-branch'
import { saveFinishItem } from '../actions'

export interface FinishValues {
  years: string
  specialties: string[]
  npi: string
  issue: string
  expires: string
  other_names: string
  states: string[]
  compact: '' | 'yes' | 'no'
  languages: string[]
  phone: string
  website: string
}

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const

export function FinishItemFlow({
  item,
  userId,
  branch,
  values: initial,
  docs: initialDocs,
}: {
  item: ProFinishItem
  userId: string
  branch: ProfessionalBranch | null
  values: FinishValues
  docs: UploadedDoc[]
}) {
  const router = useRouter()
  const [v, setV] = useState(initial)
  const [docs, setDocs] = useState(initialDocs)
  const [noOtherNames, setNoOtherNames] = useState(false)
  const set = (patch: Partial<FinishValues>) => setV((x) => ({ ...x, ...patch }))
  const save = (value: Record<string, unknown>) => () => saveFinishItem(item, value)
  const done = () => {
    router.push('/dashboard')
    router.refresh()
  }
  const onUploaded = (doc: UploadedDoc, replacedId: string | null) =>
    setDocs((prev) => [doc, ...prev.filter((d) => d.id !== replacedId)])
  const docFor = (slot: 'credential' | 'government_id') =>
    branch ? docs.find((d) => slotMatches(slot, branch).includes(d.credential_type as never) && isUsableDoc(d)) : undefined

  let screens: Screen[]
  switch (item) {
    case 'credential_upload': {
      const doc = docFor('credential')
      screens = [
        {
          id: item,
          title: branch ? PRO_COPY.upload[branch] : 'Upload your license, certification, or resume',
          sub: PRO_COPY.uploadSub,
          canContinue: () => !!doc,
          continueLabel: 'Done',
          render: () => (
            <DocumentUpload
              userId={userId}
              slot="credential"
              doc={doc}
              onUploaded={onUploaded}
              acceptsDocx={branch === 'consultant' || branch === 'educator'}
            />
          ),
        },
      ]
      break
    }
    case 'government_id': {
      const doc = docFor('government_id')
      screens = [
        {
          id: item,
          title: PRO_COPY.governmentId,
          whyWeAsk: PRO_COPY.governmentIdWhy,
          sub: 'A driver’s license, state ID, or passport.',
          canContinue: () => !!doc,
          continueLabel: 'Done',
          render: () => <DocumentUpload userId={userId} slot="government_id" doc={doc} onUploaded={onUploaded} />,
        },
      ]
      break
    }
    case 'years':
      screens = [
        {
          id: item,
          title: 'How many years of experience do you have?',
          canContinue: () => /^\d{1,2}$/.test(v.years.trim()) && Number(v.years) <= 70,
          save: save({ years: v.years }),
          render: () => (
            <div className="max-w-[200px]">
              <TextField id="years" label="Years" value={v.years} onChange={(x) => set({ years: x.replace(/\D/g, '').slice(0, 2) })} inputMode="numeric" />
            </div>
          ),
        },
      ]
      break
    case 'specialty':
      screens = [
        {
          id: item,
          title: 'What do you specialize in?',
          sub: 'Add a few focus areas clients can search for.',
          canContinue: () => v.specialties.length > 0,
          save: save({ specialties: v.specialties }),
          render: () => (
            <TagInput label="Specialty" values={v.specialties} onChange={(specialties) => set({ specialties })} placeholder="e.g., Pediatrics" max={10} />
          ),
        },
      ]
      break
    case 'npi':
      screens = [
        {
          id: item,
          title: 'What’s your NPI number?',
          whyWeAsk: 'We match it to the national NPI registry.',
          canContinue: () => /^\d{10}$/.test(v.npi),
          save: save({ npi: v.npi }),
          render: () => (
            <TextField id="npi" label="NPI number" value={v.npi} onChange={(x) => set({ npi: x.replace(/\D/g, '').slice(0, 10) })} inputMode="numeric" placeholder="10 digits" />
          ),
        },
      ]
      break
    case 'license_dates':
      screens = [
        {
          id: item,
          title: 'When was your license issued, and when does it expire?',
          whyWeAsk: 'We check this with your state licensing board.',
          canContinue: () => !!v.issue && !!v.expires && v.expires > v.issue,
          save: save({ issue: v.issue, expires: v.expires }),
          render: () => (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField id="issue" label="Issue date" type="date" value={v.issue} onChange={(x) => set({ issue: x })} />
              <TextField id="expires" label="Expiration date" type="date" value={v.expires} onChange={(x) => set({ expires: x })} />
            </div>
          ),
        },
      ]
      break
    case 'other_names':
      screens = [
        {
          id: item,
          title: 'Have you used any other names?',
          sub: 'For example, a maiden name. We use this to match your documents.',
          canContinue: () => noOtherNames || !!v.other_names.trim(),
          save: save({ names: v.other_names, none: noOtherNames }),
          render: ({ advance }) => (
            <>
              <TextField id="other_names" label="Other names" value={v.other_names} onChange={(x) => { setNoOtherNames(false); set({ other_names: x }) }} maxLength={300} />
              <button
                type="button"
                onClick={() => {
                  set({ other_names: '' })
                  setNoOtherNames(true)
                  advance()
                }}
                className="rounded text-sm font-semibold text-[#1dbf73] underline-offset-4 hover:underline"
              >
                I haven’t used other names
              </button>
            </>
          ),
        },
      ]
      break
    case 'states':
      screens = [
        {
          id: item,
          title: 'Which states are your clients in?',
          canContinue: () => v.states.length > 0,
          save: branch === 'clinical' ? undefined : save({ states: v.states }),
          render: () => <StatePicker values={v.states} onChange={(states) => set({ states })} />,
        },
        ...(branch === 'clinical'
          ? [
              {
                id: 'compact',
                title: 'Do you hold a multistate (compact) license?',
                autoAdvance: true,
                canContinue: () => !!v.compact,
                save: save({ states: v.states, compact: v.compact }),
                render: ({ advance }: { advance: () => void }) => (
                  <IconChoices
                    legend="Compact license"
                    hideLegend
                    options={YES_NO}
                    icons={YES_NO_ICONS}
                    value={v.compact}
                    onChange={(x) => {
                      set({ compact: x as FinishValues['compact'] })
                      advance()
                    }}
                    columns={2}
                  />
                ),
              } satisfies Screen,
            ]
          : []),
      ]
      break
    case 'languages':
      screens = [
        {
          id: item,
          title: 'Which languages do you work in?',
          canContinue: () => v.languages.length > 0,
          save: save({ languages: v.languages }),
          render: () => (
            <TagInput
              label="Language"
              values={v.languages}
              onChange={(languages) => set({ languages })}
              suggestions={COMMON_LANGUAGES}
              placeholder="Add another language"
              max={20}
            />
          ),
        },
      ]
      break
    case 'phone':
      screens = [
        {
          id: item,
          title: 'What’s your phone number?',
          sub: 'For booking and account alerts. It’s never shown on your profile.',
          canContinue: () => normalizeUsPhone(v.phone) !== null,
          save: save({ phone: v.phone }),
          render: () => (
            <TextField id="phone" label="Phone number" type="tel" inputMode="tel" autoComplete="tel-national" value={v.phone} onChange={(x) => set({ phone: formatUsPhoneInput(x) })} placeholder="(555) 123-4567" />
          ),
        },
      ]
      break
    case 'website':
      screens = [
        {
          id: item,
          title: PRO_COPY.website,
          canContinue: () => normalizeWebsiteUrl(v.website) !== null,
          save: save({ website: v.website }),
          render: () => (
            <TextField id="website" label="Website or LinkedIn" type="url" inputMode="url" value={v.website} onChange={(x) => set({ website: x })} placeholder="linkedin.com/in/yourname" autoComplete="url" />
          ),
        },
      ]
      break
  }

  return (
    <div className="py-4">
      <QuestionFlow
        screens={screens}
        initialIndex={0}
        stepWeights={SINGLE_STEP}
        chrome="minimal"
        flowId="professional_finish"
        onExit={() => router.push('/dashboard')}
        onFinish={done}
      />
    </div>
  )
}

/** Chips plus an add box (and optional quick picks). */
function TagInput({
  label,
  values,
  onChange,
  suggestions = [],
  placeholder,
  max,
}: {
  label: string
  values: string[]
  onChange: (v: string[]) => void
  suggestions?: readonly string[]
  placeholder?: string
  max: number
}) {
  const [draft, setDraft] = useState('')
  const has = (x: string) => values.some((y) => y.toLowerCase() === x.toLowerCase())
  const add = (raw: string) => {
    const x = raw.replace(/\s+/g, ' ').trim().slice(0, 100)
    if (x && !has(x) && values.length < max) onChange([...values, x])
    setDraft('')
  }
  return (
    <div className="space-y-3">
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={`${label}s added`}>
          {values.map((x) => (
            <li key={x}>
              <button
                type="button"
                onClick={() => onChange(values.filter((y) => y !== x))}
                aria-label={`Remove ${x}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#1dbf73] bg-[#e8faf1] px-3 py-1.5 text-sm font-medium text-[#0f8f56]"
              >
                {x}
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {suggestions.filter((s) => !has(s)).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions
            .filter((s) => !has(s))
            .slice(0, 8)
            .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => add(s)}
                className="inline-flex items-center gap-1 rounded-full border border-[#e4e5e7] bg-white px-3 py-1.5 text-sm text-[#62646a] hover:border-[#bcebd5]"
              >
                <Plus className="size-3.5" aria-hidden />
                {s}
              </button>
            ))}
        </div>
      )}
      <div className="flex gap-2">
        <label htmlFor="tag-input" className="sr-only">
          {label}
        </label>
        <input
          id="tag-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter adds the tag instead of submitting the screen.
            if (e.key === 'Enter' && draft.trim()) {
              e.preventDefault()
              add(draft)
            }
          }}
          placeholder={placeholder}
          maxLength={100}
          className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <button
          type="button"
          onClick={() => add(draft)}
          disabled={!draft.trim()}
          className="h-11 rounded-lg border border-[#e4e5e7] bg-white px-4 text-sm font-semibold text-[#404145] disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  )
}

function StatePicker({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-3">
      <label htmlFor="add-state" className="sr-only">
        Add a state
      </label>
      <select
        id="add-state"
        value=""
        onChange={(e) => {
          const s = e.target.value
          if (s && !values.includes(s)) onChange([...values, s])
        }}
        className="h-11 w-full rounded-lg border border-input bg-white px-2.5 text-sm text-[#404145] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="">Add a state…</option>
        {US_STATES.filter((s) => !values.includes(s.value)).map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="States added">
          {values.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== s))}
                aria-label={`Remove ${US_STATES.find((x) => x.value === s)?.label ?? s}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#1dbf73] bg-[#e8faf1] px-3 py-1.5 text-sm font-medium text-[#0f8f56]"
              >
                {US_STATES.find((x) => x.value === s)?.label ?? s}
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
