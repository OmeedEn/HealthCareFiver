'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { US_STATES } from '@/lib/utils/constants'
import { formatUsPhoneInput } from '@/lib/phone'
import {
  BUSINESS_STRUCTURES,
  DISCLOSURE_DETAILS_MAX,
  ORG_DESCRIPTION_MAX,
  ORG_DISCLOSURES,
  ORG_SIZES,
} from '@/lib/onboarding/organization'
import { disclosureKeysFor, type OrgFinishItem } from '@/lib/onboarding/checklist-organization'
import { QuestionFlow, SINGLE_STEP, type Screen } from '@/components/onboarding/question-flow'
import { IconChoices, IconMultiChoices } from '@/components/onboarding/choices'
import { BUSINESS_STRUCTURE_ICONS, ORG_SIZE_ICONS } from '@/components/onboarding/choice-icons'
import { SelectField, TextAreaField, TextField } from '@/app/onboarding/professional/ui'
import { markOrgAnswered, saveOrgFields } from '@/app/onboarding/organization/actions'
import { DocSlot } from '@/app/onboarding/organization/doc-slot'
import { URL_LIKE, type OrgDoc, type OrgFieldInput } from '@/app/onboarding/organization/shared'

export interface OrgFinishValues {
  description: string
  org_size: string
  zip_code: string
  location_count: string
  phone: string
  legal_name: string
  business_structure: string
  registration_state: string
  org_npi: string
  contact_title: string
  lead_linkedin: string
  facility_license_expires: string
  disclosures_picked: string[]
  disclosures_details: string
  disclosures_answered: boolean
}

const NONE = 'none'

/** One Finish your profile item as a single-question screen; back to the dashboard when done. */
export function OrgFinishFlow({
  item,
  userId,
  hasLicense,
  initial,
  initialDocs,
}: {
  item: OrgFinishItem
  userId: string
  hasLicense: boolean
  initial: OrgFinishValues
  initialDocs: OrgDoc[]
}) {
  const router = useRouter()
  const [v, setV] = useState(initial)
  const [docs, setDocs] = useState(initialDocs)
  // "None of these apply" is a real answer, so remember it was picked.
  const [none, setNone] = useState(initial.disclosures_answered && initial.disclosures_picked.length === 0)
  const set = <K extends keyof OrgFinishValues>(k: K, value: OrgFinishValues[K]) => setV((d) => ({ ...d, [k]: value }))
  const save = (fields: OrgFieldInput) => () => saveOrgFields(fields, [item])

  const uploadScreen = (kind: 'business_registration' | 'other', title: string, sub: string): Screen => {
    const mine = docs.filter((d) =>
      kind === 'other' ? d.kind === 'other' : d.kind === 'business_registration' || d.kind === 'facility_license'
    )
    return {
      id: item,
      title,
      sub,
      whyWeAsk: 'Private and encrypted. Only our review team sees it.',
      canContinue: () => mine.length > 0,
      save: () => markOrgAnswered([item]),
      render: () => (
        <DocSlot
          userId={userId}
          kind={kind}
          label={kind === 'other' ? 'Additional document' : 'Registration document'}
          docs={mine}
          onAdded={(doc) => setDocs((ds) => [...ds, doc])}
          onRemoved={(id) => setDocs((ds) => ds.filter((d) => d.id !== id))}
        />
      ),
    }
  }

  const text = (
    field: 'contact_title' | 'legal_name',
    title: string,
    label: string,
    opts: { sub?: string; required?: boolean; max: number; placeholder?: string }
  ): Screen => ({
    id: item,
    title,
    sub: opts.sub,
    fields: [field],
    canContinue: () => !opts.required || v[field].trim().length > 0,
    save: save({ [field]: v[field] }),
    render: ({ errors }) => (
      <TextField id={field} label={label} value={v[field]} onChange={(x) => set(field, x)} error={errors[field]} maxLength={opts.max} placeholder={opts.placeholder} />
    ),
  })

  const asked = disclosureKeysFor({ has_facility_license: hasLicense })
  const picked = v.disclosures_picked.filter((k) => (asked as readonly string[]).includes(k))

  const screens: Record<OrgFinishItem, () => Screen> = {
    registration_doc: () =>
      uploadScreen(
        'business_registration',
        'Upload a document that shows your organization is registered',
        'A facility license, business license, or Secretary of State registration.'
      ),
    additional_docs: () =>
      uploadScreen('other', 'Upload any other documents', 'Anything else that helps us verify your organization.'),
    disclosures: () => ({
      id: item,
      title: 'Do any of these apply to your organization?',
      sub: 'A yes doesn’t automatically disqualify you.',
      whyWeAsk: 'We run the same checks with lookups. Telling us first helps your review go faster.',
      fields: ['disclosures.picked', 'disclosures.details'],
      canContinue: () => (picked.length > 0 ? v.disclosures_details.trim().length > 0 : none),
      save: save({ disclosures: { picked: picked as never, details: picked.length ? v.disclosures_details : '' } }),
      render: ({ errors }) => (
        <>
          <IconMultiChoices
            legend="Do any of these apply to your organization?"
            hideLegend
            options={[
              ...ORG_DISCLOSURES.filter((q) => (asked as readonly string[]).includes(q.key)).map((q) => ({
                value: q.key,
                label: q.option,
              })),
              { value: NONE, label: 'None of these apply' },
            ]}
            icons={{}}
            value={none ? [NONE] : picked}
            onChange={(next) => {
              const added = next.filter((x) => !(none ? [NONE] : picked).includes(x))
              if (added.includes(NONE)) {
                setNone(true)
                set('disclosures_picked', [])
              } else {
                setNone(false)
                set('disclosures_picked', next.filter((x) => x !== NONE))
              }
            }}
            columns={1}
          />
          {picked.length > 0 && (
            <TextAreaField
              id="disclosures-details"
              label="Tell us a bit more"
              value={v.disclosures_details}
              onChange={(x) => set('disclosures_details', x)}
              maxLength={DISCLOSURE_DETAILS_MAX}
              rows={4}
              error={errors['disclosures.details']}
            />
          )}
        </>
      ),
    }),
    description: () => ({
      id: item,
      title: 'Describe your organization in a sentence or two',
      sub: 'This is what professionals and clients see once you’re approved.',
      fields: ['description'],
      canContinue: () => v.description.trim().length > 0,
      save: save({ description: v.description }),
      render: ({ errors }) => (
        <TextAreaField id="description" label="Short description" value={v.description} onChange={(x) => set('description', x)} maxLength={ORG_DESCRIPTION_MAX} counter rows={5} error={errors.description} placeholder="What your organization does and who you serve." />
      ),
    }),
    org_size: () => ({
      id: item,
      title: 'How many people work at your organization?',
      fields: ['org_size'],
      autoAdvance: true,
      canContinue: () => !!v.org_size,
      save: save({ org_size: v.org_size as never }),
      render: ({ errors, advance }) => (
        <IconChoices
          legend="Organization size"
          hideLegend
          options={ORG_SIZES.map((s) => ({ value: s, label: s, sub: 'people' }))}
          icons={ORG_SIZE_ICONS}
          value={v.org_size}
          onChange={(x) => {
            set('org_size', x)
            advance()
          }}
          error={errors.org_size}
          columns={5}
          stacked
        />
      ),
    }),
    locations: () => ({
      id: item,
      title: 'What’s your ZIP code, and how many locations do you have?',
      fields: ['zip_code', 'location_count'],
      canContinue: () => /^\d{5}$/.test(v.zip_code.trim()) && /^\d{1,5}$/.test(v.location_count.trim()),
      save: save({ zip_code: v.zip_code, location_count: v.location_count }),
      render: ({ errors }) => (
        <div className="grid grid-cols-2 gap-3">
          <TextField id="zip_code" label="ZIP code" value={v.zip_code} onChange={(x) => set('zip_code', x.replace(/\D/g, '').slice(0, 5))} error={errors.zip_code} inputMode="numeric" autoComplete="postal-code" />
          <TextField id="location_count" label="Number of locations" value={v.location_count} onChange={(x) => set('location_count', x.replace(/\D/g, '').slice(0, 5))} error={errors.location_count} inputMode="numeric" />
        </div>
      ),
    }),
    org_phone: () => ({
      id: item,
      title: 'What’s your organization’s phone number?',
      fields: ['phone'],
      canContinue: () => v.phone.replace(/\D/g, '').length >= 10,
      save: save({ phone: v.phone }),
      render: ({ errors }) => (
        <TextField id="org_phone" label="Organization phone" value={v.phone} onChange={(x) => set('phone', formatUsPhoneInput(x))} error={errors.phone} type="tel" inputMode="tel" placeholder="(555) 123-4567" autoComplete="tel-national" />
      ),
    }),
    legal_name: () =>
      text('legal_name', 'What’s your legal business name?', 'Legal business name', {
        sub: 'Only if it’s different from your organization name. Leave it blank if it’s the same.',
        max: 200,
      }),
    business_structure: () => ({
      id: item,
      title: 'How is your business structured?',
      fields: ['business_structure'],
      autoAdvance: true,
      canContinue: () => !!v.business_structure,
      save: save({ business_structure: v.business_structure as never }),
      render: ({ errors, advance }) => (
        <IconChoices
          legend="Business structure"
          hideLegend
          options={BUSINESS_STRUCTURES}
          icons={BUSINESS_STRUCTURE_ICONS}
          value={v.business_structure}
          onChange={(x) => {
            set('business_structure', x)
            advance()
          }}
          error={errors.business_structure}
          columns={2}
        />
      ),
    }),
    registration_state: () => ({
      id: item,
      title: 'Which state is your business registered in?',
      fields: ['registration_state'],
      canContinue: () => /^[A-Z]{2}$/.test(v.registration_state),
      save: save({ registration_state: v.registration_state }),
      render: ({ errors }) => (
        <SelectField id="registration_state" label="State of registration" value={v.registration_state} onChange={(x) => set('registration_state', x)} options={US_STATES} error={errors.registration_state} />
      ),
    }),
    org_npi: () => ({
      id: item,
      title: 'What’s your organization’s NPI?',
      sub: 'Your 10-digit National Provider Identifier.',
      fields: ['org_npi'],
      canContinue: () => /^\d{10}$/.test(v.org_npi),
      save: save({ org_npi: v.org_npi }),
      render: ({ errors }) => (
        <TextField id="org_npi" label="Organization NPI" value={v.org_npi} onChange={(x) => set('org_npi', x.replace(/\D/g, '').slice(0, 10))} error={errors.org_npi} inputMode="numeric" />
      ),
    }),
    contact_title: () =>
      text('contact_title', 'What’s your role or title?', 'Your role or title', {
        required: true,
        max: 100,
        placeholder: 'e.g. Director of Nursing',
      }),
    lead_linkedin: () => ({
      id: item,
      title: 'What’s the lead person’s LinkedIn?',
      fields: ['lead_linkedin'],
      canContinue: () => URL_LIKE.test(v.lead_linkedin.trim()),
      save: save({ lead_linkedin: v.lead_linkedin }),
      render: ({ errors }) => (
        <TextField id="lead_linkedin" label="LinkedIn profile" value={v.lead_linkedin} onChange={(x) => set('lead_linkedin', x)} error={errors.lead_linkedin} placeholder="linkedin.com/in/name" type="url" inputMode="url" />
      ),
    }),
    license_expires: () => ({
      id: item,
      title: 'When does your facility license expire?',
      fields: ['facility_license_expires'],
      canContinue: () => /^\d{4}-\d{2}-\d{2}$/.test(v.facility_license_expires),
      save: save({ facility_license_expires: v.facility_license_expires }),
      render: ({ errors }) => (
        <TextField id="facility_license_expires" label="Expiration date" type="date" value={v.facility_license_expires} onChange={(x) => set('facility_license_expires', x)} error={errors.facility_license_expires} />
      ),
    }),
  }

  return (
    <QuestionFlow
      screens={[screens[item]()]}
      initialIndex={0}
      stepWeights={SINGLE_STEP}
      chrome="minimal"
      flowId="organization_finish"
      onExit={() => router.push('/dashboard')}
      onFinish={() => {
        toast.success('Saved')
        router.push('/dashboard')
        router.refresh()
      }}
    />
  )
}
