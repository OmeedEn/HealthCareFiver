'use client'

import { useId, useState } from 'react'
import { Award, Check, CircleSlash, Landmark, PenLine, Plus, Search, X } from 'lucide-react'
import { IconChoices } from '@/components/onboarding/choices'
import { PROFESSIONAL_TIER_ICONS } from '@/components/onboarding/choice-icons'
import type { ActionResult, Screen } from '@/components/onboarding/question-flow'
import { SelectField, TextField } from '@/app/onboarding/professional/ui'
import { US_STATES } from '@/lib/utils/constants'
import {
  PROFESSIONS_BY_BRANCH,
  PROFESSION_MAX,
  PROFESSION_OTHER_LABEL,
  PROFESSION_PLACEHOLDER,
  isListedProfession,
  searchProfessions,
} from '@/lib/onboarding/professions'
import {
  ALLIED_CERTIFICATION_OPTIONS,
  CATEGORY_OPTIONS,
  CERTIFICATIONS_MAX,
  CERTIFICATION_NAME_MAX,
  CERTIFICATION_ORG_MAX,
  CREDENTIAL_BASIS_OPTIONS,
  EMPTY_CERTIFICATION,
  PRO_COPY,
  PRO_Q,
  branchOf,
  proValid,
  type CertificationEntry,
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
 *
 * Allied or certified: "Do you have any certifications?" Yes → enter them;
 * No → the website / LinkedIn screen (certifications are never required).
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
            // A new category means a different list on screen 2 and a
            // different credential question.
            if (category !== answers.category) set({ category, profession: '', credential_basis: '' })
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
      sub: 'Search the list. Not listed? Choose “Other” at the end.',
      canContinue: () => proValid.profession(answers.profession),
      save: save(PRO_Q.profession),
      render: () => (
        <ProfessionSearch
          key={listBranch}
          options={PROFESSIONS_BY_BRANCH[listBranch]}
          placeholder={PROFESSION_PLACEHOLDER[listBranch]}
          value={answers.profession}
          onChange={(v) => set({ profession: v })}
        />
      ),
    })
  }

  if (answers.category === 'allied') {
    screens.push({
      id: PRO_Q.credentialBasis,
      title: PRO_COPY.hasCertifications,
      sub: PRO_COPY.hasCertificationsSub,
      autoAdvance: true,
      canContinue: () => answers.credential_basis === 'certification' || answers.credential_basis === 'none',
      save: save(PRO_Q.credentialBasis),
      render: ({ advance }) => (
        <IconChoices
          legend={PRO_COPY.hasCertifications}
          hideLegend
          options={ALLIED_CERTIFICATION_OPTIONS}
          icons={BASIS_ICONS}
          value={answers.credential_basis}
          onChange={(v) => {
            set({ credential_basis: v as ProSignupAnswers['credential_basis'] })
            advance()
          }}
          columns={1}
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
      title: PRO_COPY.certifications,
      whyWeAsk: PRO_COPY.certificationsWhy,
      canContinue: () => proValid.certifications(answers.certifications),
      save: save(PRO_Q.certifyingOrg),
      render: () => (
        <CertificationsEditor value={answers.certifications} onChange={(certifications) => set({ certifications })} />
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

const OPTION_CLASS =
  'flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-left text-sm font-medium transition outline-none focus-visible:ring-3 focus-visible:ring-[#1dbf73]/30'
const optionState = (on: boolean) =>
  on ? 'border-[#1dbf73] bg-[#e8faf1] text-[#0f4c3a]' : 'border-[#e4e5e7] bg-white text-[#404145] hover:border-[#bcebd5]'

/**
 * Searchable list with an always-visible "Other / not listed" choice at the
 * end. Other reveals "What's your specialty?": that text is the answer. A
 * stored answer that isn't on the list reopens with Other picked.
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
  const otherId = useId()
  const listed = isListedProfession(options, value)
  const [query, setQuery] = useState(listed ? value : '')
  const [other, setOther] = useState(!!value.trim() && !listed)
  const matches = searchProfessions(options, query, 6)

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
          onChange={(e) => setQuery(e.target.value)}
          maxLength={PROFESSION_MAX}
          placeholder={placeholder}
          autoComplete="off"
          aria-controls={listId}
          className="h-12 w-full rounded-lg border border-input bg-white pr-3 pl-9 text-base text-[#404145] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      <ul id={listId} aria-label="Suggestions" className="grid gap-2">
        {matches.map((m) => {
          const on = !other && value === m
          return (
            <li key={m}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setOther(false)
                  setQuery(m)
                  onChange(m)
                }}
                className={`${OPTION_CLASS} ${optionState(on)}`}
              >
                {m}
                {on && <Check className="size-4 shrink-0 text-[#1dbf73]" aria-hidden />}
              </button>
            </li>
          )
        })}
        {query.trim() && matches.length === 0 && (
          <li className="px-1 text-xs text-[#62646a]">No matches. Choose “{PROFESSION_OTHER_LABEL}” below.</li>
        )}
        <li>
          <button
            type="button"
            aria-pressed={other}
            aria-expanded={other}
            aria-controls={otherId}
            onClick={() => {
              if (other) return
              setOther(true)
              // Carry over what they searched for when it isn't on the list.
              const typed = query.trim()
              onChange(typed && !isListedProfession(options, typed) ? typed.slice(0, PROFESSION_MAX) : '')
            }}
            className={`${OPTION_CLASS} ${optionState(other)}`}
          >
            <span className="flex items-center gap-2">
              <PenLine className="size-4 shrink-0 text-[#95979d]" aria-hidden />
              {PROFESSION_OTHER_LABEL}
            </span>
            {other && <Check className="size-4 shrink-0 text-[#1dbf73]" aria-hidden />}
          </button>
        </li>
      </ul>
      {other && (
        <div id={otherId}>
          <TextField
            id={`${otherId}-input`}
            label="What’s your specialty?"
            value={value}
            onChange={(v) => onChange(v.slice(0, PROFESSION_MAX))}
            maxLength={PROFESSION_MAX}
            placeholder="e.g., Sound bath practitioner"
            autoComplete="off"
          />
        </div>
      )}
    </div>
  )
}

/**
 * One or more certifications (name + issuing organization). Blank extra
 * rows are ignored when saving.
 */
function CertificationsEditor({
  value,
  onChange,
}: {
  value: CertificationEntry[]
  onChange: (v: CertificationEntry[]) => void
}) {
  const baseId = useId()
  const rows = value.length ? value : [{ ...EMPTY_CERTIFICATION }]
  const update = (i: number, patch: Partial<CertificationEntry>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div
          key={i}
          role="group"
          aria-label={rows.length > 1 ? `Certification ${i + 1}` : 'Certification'}
          className="space-y-3 rounded-xl border border-[#e4e5e7] bg-white p-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-[#62646a] uppercase" aria-hidden>
              {rows.length > 1 ? `Certification ${i + 1}` : 'Certification'}
            </span>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
                aria-label={`Remove certification ${i + 1}`}
                className="-mr-1 flex size-8 items-center justify-center rounded-full text-[#95979d] transition hover:bg-[#f1f1f2] hover:text-[#404145] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1dbf73]"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
          <TextField
            id={`${baseId}-name-${i}`}
            label="Name of certification"
            value={row.name}
            onChange={(v) => update(i, { name: v })}
            maxLength={CERTIFICATION_NAME_MAX}
            placeholder="e.g., Certified Personal Trainer"
            autoComplete="off"
          />
          <TextField
            id={`${baseId}-org-${i}`}
            label="Certifying organization"
            value={row.organization}
            onChange={(v) => update(i, { organization: v })}
            maxLength={CERTIFICATION_ORG_MAX}
            placeholder="e.g., NASM, DONA International, NCBTMB"
            autoComplete="off"
          />
        </div>
      ))}
      {rows.length < CERTIFICATIONS_MAX && (
        <button
          type="button"
          onClick={() => onChange([...rows, { ...EMPTY_CERTIFICATION }])}
          className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-[#1dbf73] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1dbf73]"
        >
          <Plus className="size-4" aria-hidden />
          {PRO_COPY.addCertification}
        </button>
      )}
    </div>
  )
}
