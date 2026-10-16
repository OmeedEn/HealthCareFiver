'use client'

import { useId, useState } from 'react'
import { Award, Check, CircleSlash, Landmark, Search } from 'lucide-react'
import { IconChoices } from '@/components/onboarding/choices'
import { PROFESSIONAL_TIER_ICONS } from '@/components/onboarding/choice-icons'
import type { ActionResult, Screen } from '@/components/onboarding/question-flow'
import { SelectField, TextField } from '@/app/onboarding/professional/ui'
import { US_STATES } from '@/lib/utils/constants'
import {
  PROFESSIONS_BY_BRANCH,
  PROFESSION_MAX,
  PROFESSION_PLACEHOLDER,
  searchProfessions,
} from '@/lib/onboarding/professions'
import {
  CATEGORY_OPTIONS,
  CREDENTIAL_BASIS_OPTIONS,
  PRO_COPY,
  PRO_Q,
  branchOf,
  proValid,
  type ProQuestionId,
  type ProSignupAnswers,
} from '@/lib/onboarding/questions/professional'
import type { ProfessionalBranch } from '@/lib/onboarding/professional-branch'

const BASIS_ICONS = { license: Landmark, certification: Award, none: CircleSlash }

type Setter = (patch: Partial<ProSignupAnswers>) => void

/**
 * Screens 1–3 of professional onboarding as QuestionFlow screens. Used before
 * the account (/signup/professional, answers in sessionStorage) and, as a
 * fallback, after it (/onboarding/professional, when a Google signup lost its
 * cookie or an older account has no category) — then `persist` saves each
 * answer.
 */
export function identityScreens({
  answers,
  set,
  persist,
}: {
  answers: ProSignupAnswers
  set: Setter
  persist?: (id: ProQuestionId, answers: ProSignupAnswers) => Promise<ActionResult>
}): Screen[] {
  const save = (id: ProQuestionId) => (persist ? () => persist(id, answers) : undefined)
  const branch = branchOf(answers)
  const screens: Screen[] = [
    {
      id: PRO_Q.category,
      title: PRO_COPY.category,
      autoAdvance: true,
      canContinue: () => !!answers.category,
      save: save(PRO_Q.category),
      render: ({ advance }) => (
        <IconChoices
          legend={PRO_COPY.category}
          hideLegend
          options={CATEGORY_OPTIONS}
          icons={PROFESSIONAL_TIER_ICONS}
          value={answers.category}
          onChange={(v) => {
            const category = v as ProSignupAnswers['category']
            // A new category means a different list on screen 2.
            if (category !== answers.category) set({ category, profession: '' })
            advance()
          }}
          columns={1}
        />
      ),
    },
  ]

  if (answers.category === 'other') {
    screens.push(
      {
        id: PRO_Q.otherProfession,
        title: PRO_COPY.otherProfession,
        canContinue: () => proValid.profession(answers.other_profession),
        save: save(PRO_Q.otherProfession),
        render: () => (
          <TextField
            id="other_profession"
            label="Your profession"
            value={answers.other_profession}
            onChange={(v) => set({ other_profession: v })}
            maxLength={PROFESSION_MAX}
            placeholder="e.g., Art therapist"
          />
        ),
      },
      {
        id: PRO_Q.credentialBasis,
        title: PRO_COPY.credentialBasis,
        autoAdvance: true,
        canContinue: () => !!answers.credential_basis,
        save: save(PRO_Q.credentialBasis),
        render: ({ advance }) => (
          <IconChoices
            legend={PRO_COPY.credentialBasis}
            hideLegend
            options={CREDENTIAL_BASIS_OPTIONS}
            icons={BASIS_ICONS}
            value={answers.credential_basis}
            onChange={(v) => {
              set({ credential_basis: v as ProSignupAnswers['credential_basis'] })
              advance()
            }}
            columns={1}
          />
        ),
      }
    )
  } else {
    const listBranch: ProfessionalBranch = answers.category || 'clinical'
    screens.push({
      id: PRO_Q.profession,
      title: PRO_COPY.profession,
      sub: 'Search the list, or type your own.',
      canContinue: () => proValid.profession(answers.profession),
      save: save(PRO_Q.profession),
      render: () => (
        <ProfessionSearch
          options={PROFESSIONS_BY_BRANCH[listBranch]}
          placeholder={PROFESSION_PLACEHOLDER[listBranch]}
          value={answers.profession}
          onChange={(v) => set({ profession: v })}
        />
      ),
    })
  }

  if (branch === 'clinical' || !branch) {
    screens.push({
      id: PRO_Q.license,
      title: PRO_COPY.license,
      whyWeAsk: PRO_COPY.licenseWhy,
      canContinue: () => proValid.licenseNumber(answers.license_number) && proValid.state(answers.license_state),
      save: save(PRO_Q.license),
      render: () => (
        <>
          <TextField
            id="license_number"
            label="License number"
            value={answers.license_number}
            onChange={(v) => set({ license_number: v })}
            maxLength={50}
            autoComplete="off"
          />
          <SelectField
            id="license_state"
            label="Issuing state"
            value={answers.license_state}
            onChange={(v) => set({ license_state: v })}
            options={US_STATES}
            placeholder="Choose a state"
          />
        </>
      ),
    })
  } else if (branch === 'allied') {
    screens.push({
      id: PRO_Q.certifyingOrg,
      title: PRO_COPY.certifyingOrg,
      whyWeAsk: 'We check your certification with them.',
      canContinue: () => proValid.certifyingOrg(answers.certifying_organization),
      save: save(PRO_Q.certifyingOrg),
      render: () => (
        <TextField
          id="certifying_organization"
          label="Certifying organization"
          value={answers.certifying_organization}
          onChange={(v) => set({ certifying_organization: v })}
          maxLength={150}
          placeholder="e.g., NASM, DONA International, NCBTMB"
        />
      ),
    })
  } else {
    screens.push({
      id: PRO_Q.website,
      title: PRO_COPY.website,
      canContinue: () => proValid.website(answers.website_url),
      save: save(PRO_Q.website),
      render: ({ advance }) => (
        <>
          <TextField
            id="website_url"
            label="Website or LinkedIn"
            type="url"
            inputMode="url"
            value={answers.website_url}
            onChange={(v) => set({ website_url: v, no_website: false })}
            maxLength={500}
            placeholder="linkedin.com/in/yourname"
            autoComplete="url"
          />
          <button
            type="button"
            onClick={() => {
              set({ website_url: '', no_website: true })
              advance()
            }}
            className="rounded text-sm font-semibold text-[#1dbf73] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1dbf73]"
          >
            {PRO_COPY.noWebsite}
          </button>
          {answers.no_website && !answers.website_url && (
            <p className="text-xs text-[#62646a]">
              No problem. We’ll ask for your resume or CV instead.
            </p>
          )}
        </>
      ),
    })
  }

  // "I don't have one" advances with an empty link: let that through.
  const website = screens.find((s) => s.id === PRO_Q.website)
  if (website) {
    const check = website.canContinue!
    website.canContinue = () => answers.no_website || check()
  }
  return screens
}

/** Index of the first pre-account screen still missing a valid answer. */
export function firstOpenIdentityScreen(screens: Screen[]): number {
  const i = screens.findIndex((s) => s.canContinue && !s.canContinue())
  return i === -1 ? screens.length : i
}

/**
 * Searchable list, or type your own: the typed text is the answer unless
 * they tap a suggestion.
 */
function ProfessionSearch({
  options,
  placeholder,
  value,
  onChange,
}: {
  options: readonly string[]
  placeholder: string
  value: string
  onChange: (v: string) => void
}) {
  const inputId = useId()
  const listId = useId()
  const [query, setQuery] = useState(value)
  const matches = searchProfessions(options, query, 6)
  const exact = options.some((o) => o.toLowerCase() === query.trim().toLowerCase())

  return (
    <div className="space-y-3">
      <label htmlFor={inputId} className="sr-only">
        {PRO_COPY.profession}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#95979d]" aria-hidden />
        <input
          id={inputId}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            onChange(e.target.value.slice(0, PROFESSION_MAX))
          }}
          maxLength={PROFESSION_MAX}
          placeholder={placeholder}
          autoComplete="off"
          aria-controls={listId}
          className="h-12 w-full rounded-lg border border-input bg-white pr-3 pl-9 text-base text-[#404145] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      <ul id={listId} aria-label="Suggestions" className="grid gap-2">
        {matches.map((m) => {
          const on = value === m
          return (
            <li key={m}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setQuery(m)
                  onChange(m)
                }}
                className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-left text-sm font-medium transition outline-none focus-visible:ring-3 focus-visible:ring-[#1dbf73]/30 ${
                  on
                    ? 'border-[#1dbf73] bg-[#e8faf1] text-[#0f4c3a]'
                    : 'border-[#e4e5e7] bg-white text-[#404145] hover:border-[#bcebd5]'
                }`}
              >
                {m}
                {on && <Check className="size-4 shrink-0 text-[#1dbf73]" aria-hidden />}
              </button>
            </li>
          )
        })}
      </ul>
      {query.trim() && !exact && (
        <p className="text-xs text-[#62646a]">
          Not listed? Continue with “{query.trim()}”.
        </p>
      )}
    </div>
  )
}
