'use client'

import { Globe } from 'lucide-react'
import { US_STATES } from '@/lib/utils/constants'
import { ORG_TYPE_OTHER_MAX } from '@/lib/onboarding/organization'
import { ORG_QUESTIONS, NO_WEBSITE_LABEL, asksFacilityLicense } from '@/lib/onboarding/questions/organization'
import type { OrgSignupPath } from '@/lib/onboarding/signup-path'
import type { ActionResult, Screen } from '@/components/onboarding/question-flow'
import { IconChoices } from '@/components/onboarding/choices'
import { ORG_TYPE_ICONS, YES_NO_ICONS } from '@/components/onboarding/choice-icons'
import { SelectField, TextField } from '../professional/ui'
import { URL_LIKE, orgTypeOptionsFor, type YesNo } from './shared'

/**
 * Organization question screens (Single-Question Onboarding spec), shared by
 * the pre-account signup (/signup/organization, screens 1–2), onboarding
 * (/onboarding/organization, screens 1–2 for staff-assigned accounts and
 * 4–6) and the dashboard. Copy and ids come from
 * src/lib/onboarding/questions/organization.ts. `save` is optional: the
 * pre-account screens only hold answers in the browser.
 */

export interface OrgAnswers {
  org_type: string
  org_type_other: string
  facility_name: string
  website: string
  has_no_website: boolean
  city: string
  state: string
  has_facility_license: YesNo
  facility_license_type: string
  facility_license_number: string
  facility_license_agency: string
  lead_has_credential: YesNo
  lead_credential_type: string
  lead_credential_number: string
  lead_credential_state: string
}

export const EMPTY_ORG_ANSWERS: OrgAnswers = {
  org_type: '',
  org_type_other: '',
  facility_name: '',
  website: '',
  has_no_website: false,
  city: '',
  state: '',
  has_facility_license: '',
  facility_license_type: '',
  facility_license_number: '',
  facility_license_agency: '',
  lead_has_credential: '',
  lead_credential_type: '',
  lead_credential_number: '',
  lead_credential_state: '',
}

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const

const has = (v: string) => v.trim().length > 0

export interface OrgScreenCtx {
  v: OrgAnswers
  set: <K extends keyof OrgAnswers>(k: K, value: OrgAnswers[K]) => void
  door: OrgSignupPath
  /** Persist a screen's fields (post-account). Absent = held in the browser only. */
  save?: (fields: Partial<OrgAnswers>, questionId: string) => Promise<ActionResult>
}

/** Screen 1: "What type of organization are you?" (Other opens a required text box). */
export function typeScreen({ v, set, door, save }: OrgScreenCtx): Screen {
  const q = ORG_QUESTIONS.type
  const options = orgTypeOptionsFor(door, v.org_type)
  return {
    id: q.id,
    title: q.text,
    fields: ['org_type', 'org_type_other'],
    autoAdvance: v.org_type !== 'other',
    canContinue: () => has(v.org_type) && (v.org_type !== 'other' || has(v.org_type_other)),
    save: save
      ? () => save({ org_type: v.org_type, org_type_other: v.org_type === 'other' ? v.org_type_other : '' }, q.id)
      : undefined,
    render: ({ errors, advance }) => (
      <>
        <IconChoices
          legend={q.text}
          hideLegend
          options={options}
          icons={ORG_TYPE_ICONS}
          value={v.org_type}
          onChange={(x) => {
            set('org_type', x)
            if (x !== 'other') advance()
          }}
          error={errors.org_type}
          columns={2}
        />
        {v.org_type === 'other' && (
          <TextField
            id="org_type_other"
            label="What kind of organization are you?"
            value={v.org_type_other}
            onChange={(x) => set('org_type_other', x)}
            maxLength={ORG_TYPE_OTHER_MAX}
            error={errors.org_type_other}
          />
        )}
      </>
    ),
  }
}

/** Screen 2: "What's your organization's name?" */
export function nameScreen({ v, set, save }: OrgScreenCtx): Screen {
  const q = ORG_QUESTIONS.name
  return {
    id: q.id,
    title: q.text,
    sub: q.sub,
    fields: ['facility_name'],
    canContinue: () => has(v.facility_name) && v.facility_name.trim().length <= 200,
    save: save ? () => save({ facility_name: v.facility_name }, q.id) : undefined,
    render: ({ errors }) => (
      <TextField
        id="facility_name"
        label="Organization name"
        value={v.facility_name}
        onChange={(x) => set('facility_name', x)}
        error={errors.facility_name}
        placeholder={q.placeholder}
        maxLength={200}
        autoComplete="organization"
      />
    ),
  }
}

/** Screen 4: website, or "We don't have a website" (stored as has_no_website). */
export function websiteScreen({ v, set, save }: OrgScreenCtx): Screen {
  const q = ORG_QUESTIONS.website
  return {
    id: q.id,
    title: q.text,
    sub: q.sub,
    fields: ['website', 'has_no_website'],
    canContinue: () => v.has_no_website || URL_LIKE.test(v.website.trim()),
    save: save
      ? () =>
          save(
            v.has_no_website ? { website: '', has_no_website: true } : { website: v.website, has_no_website: false },
            q.id
          )
      : undefined,
    render: ({ errors }) => (
      <>
        <TextField
          id="website"
          label="Website"
          value={v.website}
          onChange={(x) => {
            set('website', x)
            if (x.trim()) set('has_no_website', false)
          }}
          error={errors.website}
          placeholder={q.placeholder}
          type="url"
          inputMode="url"
          autoComplete="url"
          disabled={v.has_no_website}
        />
        <button
          type="button"
          aria-pressed={v.has_no_website}
          onClick={() => {
            const next = !v.has_no_website
            set('has_no_website', next)
            if (next) set('website', '')
          }}
          className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left text-base font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1dbf73] ${
            v.has_no_website
              ? 'border-[#1dbf73] bg-[#e8faf1] text-[#0f8f56]'
              : 'border-[#e4e5e7] bg-white text-[#404145] hover:border-[#bcebd5]'
          }`}
        >
          <Globe className="size-5 shrink-0" aria-hidden />
          {NO_WEBSITE_LABEL}
        </button>
      </>
    ),
  }
}

/** Screen 5: "Which city and state are you in?" */
export function locationScreen({ v, set, save }: OrgScreenCtx): Screen {
  const q = ORG_QUESTIONS.location
  return {
    id: q.id,
    title: q.text,
    sub: q.sub,
    whyWeAsk: q.whyWeAsk,
    fields: ['city', 'state'],
    canContinue: () => has(v.city) && /^[A-Z]{2}$/.test(v.state),
    save: save ? () => save({ city: v.city, state: v.state }, q.id) : undefined,
    render: ({ errors }) => (
      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <TextField
          id="city"
          label="City"
          value={v.city}
          onChange={(x) => set('city', x)}
          error={errors.city}
          autoComplete="address-level2"
          maxLength={100}
        />
        <SelectField
          id="state"
          label="State"
          value={v.state}
          onChange={(x) => set('state', x)}
          options={US_STATES}
          error={errors.state}
        />
      </div>
    ),
  }
}

/**
 * Screen 6, by door: Practice/Hiring answer the facility license question,
 * Company the lead person's credential. Yes → the details screen follows.
 */
export function licenseScreens({ v, set, door, save }: OrgScreenCtx): Screen[] {
  const facility = asksFacilityLicense(door)
  const q = facility ? ORG_QUESTIONS.facilityLicense : ORG_QUESTIONS.leadCredential
  const dq = facility ? ORG_QUESTIONS.facilityLicenseDetails : ORG_QUESTIONS.leadCredentialDetails
  const key = facility ? 'has_facility_license' : 'lead_has_credential'
  const answer = v[key]

  const question: Screen = {
    id: q.id,
    title: q.text,
    whyWeAsk: q.whyWeAsk,
    fields: [key],
    autoAdvance: true,
    canContinue: () => answer === 'yes' || answer === 'no',
    save: save ? () => save({ [key]: answer }, q.id) : undefined,
    render: ({ errors, advance }) => (
      <IconChoices
        legend={q.text}
        hideLegend
        options={YES_NO}
        icons={YES_NO_ICONS}
        value={answer}
        onChange={(x) => {
          set(key, x as YesNo)
          advance()
        }}
        error={errors[key]}
        columns={2}
      />
    ),
  }
  if (answer !== 'yes') return [question]

  const details: Screen = facility
    ? {
        id: dq.id,
        title: dq.text,
        whyWeAsk: dq.whyWeAsk,
        fields: ['facility_license_type', 'facility_license_number', 'facility_license_agency'],
        canContinue: () =>
          has(v.facility_license_type) && has(v.facility_license_number) && has(v.facility_license_agency),
        save: save
          ? () =>
              save(
                {
                  facility_license_type: v.facility_license_type,
                  facility_license_number: v.facility_license_number,
                  facility_license_agency: v.facility_license_agency,
                },
                dq.id
              )
          : undefined,
        render: ({ errors }) => (
          <>
            <TextField id="facility_license_type" label="License type" value={v.facility_license_type} onChange={(x) => set('facility_license_type', x)} error={errors.facility_license_type} placeholder="e.g. Primary care clinic" maxLength={200} />
            <TextField id="facility_license_number" label="License number" value={v.facility_license_number} onChange={(x) => set('facility_license_number', x)} error={errors.facility_license_number} maxLength={100} />
            <TextField id="facility_license_agency" label="Issuing agency" value={v.facility_license_agency} onChange={(x) => set('facility_license_agency', x)} error={errors.facility_license_agency} placeholder="e.g. California Department of Public Health" maxLength={200} />
          </>
        ),
      }
    : {
        id: dq.id,
        title: dq.text,
        whyWeAsk: dq.whyWeAsk,
        fields: ['lead_credential_type', 'lead_credential_number', 'lead_credential_state'],
        canContinue: () =>
          has(v.lead_credential_type) && has(v.lead_credential_number) && /^[A-Z]{2}$/.test(v.lead_credential_state),
        save: save
          ? () =>
              save(
                {
                  lead_credential_type: v.lead_credential_type,
                  lead_credential_number: v.lead_credential_number,
                  lead_credential_state: v.lead_credential_state,
                },
                dq.id
              )
          : undefined,
        render: ({ errors }) => (
          <>
            <TextField id="lead_credential_type" label="License or certification type" value={v.lead_credential_type} onChange={(x) => set('lead_credential_type', x)} error={errors.lead_credential_type} placeholder="e.g. RN, bar admission, CPC" maxLength={200} />
            <TextField id="lead_credential_number" label="License or certification number" value={v.lead_credential_number} onChange={(x) => set('lead_credential_number', x)} error={errors.lead_credential_number} maxLength={100} />
            <SelectField id="lead_credential_state" label="State" value={v.lead_credential_state} onChange={(x) => set('lead_credential_state', x)} options={US_STATES} error={errors.lead_credential_state} />
          </>
        ),
      }
  return [question, details]
}
