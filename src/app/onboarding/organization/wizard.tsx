'use client'

import { useMemo, useState } from 'react'
import { Clock } from 'lucide-react'
import { toast } from 'sonner'
import { US_STATES } from '@/lib/utils/constants'
import { formatUsPhoneInput } from '@/lib/phone'
import {
  ATTEST_AUTHORIZED_LABEL,
  ATTEST_CHECKS_LABEL,
  BUSINESS_STRUCTURES,
  DISCLOSURE_DETAILS_MAX,
  HIRING_TIMELINES,
  LOOKING_FOR_ENGAGEMENTS,
  ORG_DESCRIPTION_MAX,
  ORG_DISCLOSURES,
  ORG_DOCUMENT_KINDS,
  ORG_INTENTS,
  ORG_SIZES,
  ORG_TYPE_OTHER_MAX,
  PROFESSIONAL_TIERS,
  REVIEW_NOTE,
  STAFFING_POSTS_ENABLED,
  WORK_SETTINGS,
  type OrgIntent,
  type OrgWizardStep,
} from '@/lib/onboarding/organization'
import { CheckRow, SelectField, TextAreaField, TextField } from '../professional/ui'
import {
  finishOnboarding,
  saveAbout,
  saveAboutDraft,
  saveIntents,
  saveListing,
  saveLookingFor,
  saveVerification,
  saveVerifyDraft,
  type ActionResult,
} from './actions'
import { DocSlot } from './doc-slot'
import { localInputToIso } from './listing-draft'
import { eventScreens, serviceScreens } from './listing-questions'
import { QuestionFlow, type Screen as FlowScreen } from './flow'

/** Screens are tagged with their step when the flow is assembled. */
type Screen = Omit<FlowScreen, 'step'>
import { IconChoices, IconMultiChoices } from './sections/fields'
import {
  BUSINESS_STRUCTURE_ICONS,
  ENGAGEMENT_ICONS,
  FORMAT_ICONS,
  ORG_INTENT_ICONS,
  ORG_SIZE_ICONS,
  ORG_TYPE_ICONS,
  PROFESSIONAL_TIER_ICONS,
  TIMELINE_ICONS,
  YES_NO_ICONS,
} from './sections/choice-icons'
import { EMPTY_EVENT } from './sections/event-form'
import { EMPTY_LOOKING_FOR } from './sections/looking-for-form'
import { EMPTY_SERVICE } from './sections/service-form'
import { StaffingForm } from './sections/staffing-form'
import type { OrgSignupPath } from '@/lib/onboarding/signup-path'
import {
  aboutFields,
  asksFacilityLicense,
  checkFields,
  orgTypeOptionsFor,
  URL_LIKE,
  lookingForSchema,
  verifyFields,
  type AboutData,
  type EventDraft,
  type LookingForData,
  type OrgDoc,
  type ServiceDraft,
  type VerifyData,
  type YesNo,
} from './shared'

const OK: ActionResult = { ok: true }
const NOW_OR_LATER = [
  { value: 'now', label: 'Yes, set it up now', sub: 'Takes about a minute.' },
  { value: 'later', label: 'Skip for now', sub: 'Do it anytime from your dashboard.' },
] as const
const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const

type SetupChoice = '' | 'now' | 'later'

const SECTION = {
  2: 'About your organization',
  3: 'Verify your organization',
  4: 'Your goals',
  5: 'Quick setup',
} as const

/**
 * Organization onboarding (steps 2–5; step 1 is /signup/organization), asked
 * one question per screen. Answers save as they're given (saveAboutDraft /
 * saveVerifyDraft); each step's last screen runs the full step save, which
 * also bumps facility_profiles.onboarding_step. A refresh resumes at the
 * first unanswered question of the saved step.
 */
export function OrgOnboardingWizard({
  userId,
  door,
  initialStep,
  initialAbout,
  initialVerify,
  initialDocs,
  initialIntents,
}: {
  userId: string
  /** Signup door (profiles.signup_path); null legacy accounts arrive as HIRING. */
  door: OrgSignupPath
  initialStep: OrgWizardStep
  initialAbout: AboutData
  initialVerify: VerifyData
  initialDocs: OrgDoc[]
  initialIntents: OrgIntent[]
}) {
  const [about, setAbout] = useState(initialAbout)
  const [verify, setVerify] = useState(initialVerify)
  const [docs, setDocs] = useState(initialDocs)
  const [intents, setIntents] = useState(initialIntents)
  const [setup, setSetup] = useState<Partial<Record<OrgIntent, SetupChoice>>>({})
  const [saved, setSaved] = useState<Partial<Record<OrgIntent, boolean>>>({})
  const [service, setService] = useState<ServiceDraft>(EMPTY_SERVICE)
  const [event, setEvent] = useState<EventDraft>(EMPTY_EVENT)
  const [lookingFor, setLookingFor] = useState<LookingForData>(EMPTY_LOOKING_FOR)

  const setA = <K extends keyof AboutData>(k: K, v: AboutData[K]) => setAbout((d) => ({ ...d, [k]: v }))
  const setV = <K extends keyof VerifyData>(k: K, v: VerifyData[K]) => setVerify((d) => ({ ...d, [k]: v }))
  const setS = <K extends keyof ServiceDraft>(k: K, v: ServiceDraft[K]) => setService((d) => ({ ...d, [k]: v }))
  const setE = <K extends keyof EventDraft>(k: K, v: EventDraft[K]) => setEvent((d) => ({ ...d, [k]: v }))
  const setL = <K extends keyof LookingForData>(k: K, v: LookingForData[K]) =>
    setLookingFor((d) => ({ ...d, [k]: v }))
  const setDisclosure = (key: string, patch: Partial<{ answer: YesNo; details: string }>) =>
    setVerify((d) => ({
      ...d,
      disclosures: { ...d.disclosures, [key]: { ...(d.disclosures[key] ?? { answer: '', details: '' }), ...patch } },
    }))

  const aboutCheck = (keys: (keyof AboutData)[]) => checkFields(aboutFields, keys, { ...about })
  const verifyCheck = (keys: (keyof typeof verifyFields)[]) => checkFields(verifyFields, keys, { ...verify })
  const aboutDraft = (keys: (keyof AboutData)[]) => () =>
    saveAboutDraft(Object.fromEntries(keys.map((k) => [k, about[k]])) as Partial<AboutData>)
  const verifyDraft = (keys: (keyof VerifyData)[]) => () =>
    saveVerifyDraft(Object.fromEntries(keys.map((k) => [k, verify[k]])))
  // Company orgs answer the lead person's credential question instead of
  // the facility license one.
  const facility = asksFacilityLicense(door)
  const hasLicense = facility && verify.has_facility_license === 'yes'
  const leadHasCredential = !facility && verify.lead_has_credential === 'yes'
  // Fixed per account, so computing from the first-render value is fine.
  const [orgTypeOptions] = useState(() => orgTypeOptionsFor(door, initialAbout.org_type))
  const docSlot = (kind: (typeof ORG_DOCUMENT_KINDS)[number]['kind'], error?: string) => {
    const meta = ORG_DOCUMENT_KINDS.find((k) => k.kind === kind)!
    return (
      <DocSlot
        userId={userId}
        kind={kind}
        label={meta.label}
        docs={docs.filter((d) => d.kind === kind)}
        onAdded={(doc) => setDocs((ds) => [...ds, doc])}
        onRemoved={(id) => setDocs((ds) => ds.filter((d) => d.id !== id))}
        error={error}
      />
    )
  }
  const need = (cond: boolean, key: string, msg: string): Record<string, string> => (cond ? {} : { [key]: msg })

  /* ───────────── Step 2: About ───────────── */
  const aboutScreens: Screen[] = [
    {
      id: 'facility_name',
      section: SECTION[2],
      title: 'What’s your organization called?',
      sub: 'Use the name the public knows you by.',
      fields: ['facility_name'],
      validate: () => aboutCheck(['facility_name']),
      save: aboutDraft(['facility_name']),
      render: ({ errors }) => (
        <TextField id="facility_name" label="Organization name" value={about.facility_name} onChange={(v) => setA('facility_name', v)} error={errors.facility_name} autoComplete="organization" />
      ),
    },
    {
      id: 'org_type',
      section: SECTION[2],
      title: 'What kind of organization is it?',
      fields: ['org_type', 'org_type_other'],
      validate: () => ({
        ...aboutCheck(['org_type']),
        ...(about.org_type === 'other'
          ? need(!!about.org_type_other.trim(), 'org_type_other', 'Tell us what kind of organization you are')
          : {}),
      }),
      save: aboutDraft(['org_type', 'org_type_other']),
      render: ({ errors, advance }) => (
        <>
          <IconChoices
            legend="Organization type"
            hideLegend
            options={orgTypeOptions}
            icons={ORG_TYPE_ICONS}
            value={about.org_type}
            onChange={(v) => {
              setA('org_type', v)
              if (v !== 'other') advance()
            }}
            error={errors.org_type}
            columns={2}
          />
          {about.org_type === 'other' && (
            <TextField id="org_type_other" label="What kind of organization?" value={about.org_type_other} onChange={(v) => setA('org_type_other', v)} maxLength={ORG_TYPE_OTHER_MAX} error={errors.org_type_other} />
          )}
        </>
      ),
    },
    {
      id: 'org_size',
      section: SECTION[2],
      title: 'How many people work there?',
      fields: ['org_size'],
      validate: () => aboutCheck(['org_size']),
      save: aboutDraft(['org_size']),
      render: ({ errors, advance }) => (
        <IconChoices
          legend="Organization size"
          hideLegend
          options={ORG_SIZES.map((s) => ({ value: s, label: s, sub: 'people' }))}
          icons={ORG_SIZE_ICONS}
          value={about.org_size}
          onChange={(v) => {
            setA('org_size', v)
            advance()
          }}
          error={errors.org_size}
          columns={5}
          stacked
        />
      ),
    },
    {
      id: 'location',
      section: SECTION[2],
      title: 'Where’s your main location?',
      fields: ['city', 'state', 'zip_code'],
      validate: () => aboutCheck(['city', 'state', 'zip_code']),
      save: aboutDraft(['city', 'state', 'zip_code']),
      render: ({ errors }) => (
        <>
          <TextField id="city" label="City" value={about.city} onChange={(v) => setA('city', v)} error={errors.city} autoComplete="address-level2" />
          <div className="grid grid-cols-[1fr_140px] gap-3">
            <SelectField id="state" label="State" value={about.state} onChange={(v) => setA('state', v)} options={US_STATES} error={errors.state} />
            <TextField id="zip_code" label="ZIP" value={about.zip_code} onChange={(v) => setA('zip_code', v)} error={errors.zip_code} inputMode="numeric" autoComplete="postal-code" />
          </div>
        </>
      ),
    },
    {
      id: 'location_count',
      section: SECTION[2],
      title: 'How many locations do you have?',
      sub: 'You can add more later.',
      fields: ['location_count'],
      validate: () => aboutCheck(['location_count']),
      save: aboutDraft(['location_count']),
      render: ({ errors }) => (
        <div className="max-w-[200px]">
          <TextField id="location_count" label="Number of locations" value={about.location_count} onChange={(v) => setA('location_count', v.replace(/\D/g, ''))} error={errors.location_count} inputMode="numeric" />
        </div>
      ),
    },
    {
      id: 'contact',
      section: SECTION[2],
      title: 'How can people find and reach you?',
      fields: ['website', 'phone'],
      validate: () => aboutCheck(['website', 'phone']),
      save: aboutDraft(['website', 'phone']),
      render: ({ errors }) => (
        <>
          <TextField id="website" label="Website" value={about.website} onChange={(v) => setA('website', v)} error={errors.website} placeholder="yourorganization.com" autoComplete="url" />
          <TextField id="org_phone" label="Organization phone" value={about.phone} onChange={(v) => setA('phone', formatUsPhoneInput(v))} error={errors.phone} type="tel" inputMode="tel" placeholder="(555) 123-4567" />
        </>
      ),
    },
    {
      id: 'description',
      section: SECTION[2],
      title: 'Describe your organization in a sentence or two',
      sub: 'This is what professionals and clients see once you’re approved.',
      fields: ['description'],
      validate: () => aboutCheck(['description']),
      // Last question of the step: full save, which also advances the step.
      save: () => saveAbout(about),
      render: ({ errors }) => (
        <TextAreaField id="description" label="Short description" value={about.description} onChange={(v) => setA('description', v)} maxLength={ORG_DESCRIPTION_MAX} counter rows={5} error={errors.description} placeholder="What your organization does and who you serve." />
      ),
    },
  ]

  /* ───────────── Step 3: Verify ───────────── */
  // Practice and Hiring doors: the facility license question (+ details).
  const facilityScreens: Screen[] = [
    {
      id: 'has_facility_license',
      section: SECTION[3],
      title: 'Does your organization hold a facility or operating license?',
      fields: ['has_facility_license'],
      validate: () => need(!!verify.has_facility_license, 'has_facility_license', 'Answer yes or no'),
      save: verifyDraft(['has_facility_license']),
      render: ({ errors, advance }) => (
        <IconChoices
          legend="Facility license"
          hideLegend
          options={YES_NO}
          icons={YES_NO_ICONS}
          value={verify.has_facility_license}
          onChange={(v) => {
            setV('has_facility_license', v as YesNo)
            advance()
          }}
          error={errors.has_facility_license}
          columns={2}
        />
      ),
    },
    ...(hasLicense
      ? ([
          {
            id: 'license_number',
            section: SECTION[3],
            title: 'Tell us about the license',
            fields: ['facility_license_type', 'facility_license_number'],
            validate: () => ({
              ...need(!!verify.facility_license_type.trim(), 'facility_license_type', 'License type is required'),
              ...need(!!verify.facility_license_number.trim(), 'facility_license_number', 'License number is required'),
            }),
            save: verifyDraft(['facility_license_type', 'facility_license_number']),
            render: ({ errors }) => (
              <>
                <TextField id="facility_license_type" label="License type" value={verify.facility_license_type} onChange={(v) => setV('facility_license_type', v)} error={errors.facility_license_type} placeholder="e.g. Primary care clinic" />
                <TextField id="facility_license_number" label="License number" value={verify.facility_license_number} onChange={(v) => setV('facility_license_number', v)} error={errors.facility_license_number} />
              </>
            ),
          },
          {
            id: 'license_agency',
            section: SECTION[3],
            title: 'Who issued it, and when does it expire?',
            fields: ['facility_license_agency', 'facility_license_expires'],
            validate: () => ({
              ...need(!!verify.facility_license_agency.trim(), 'facility_license_agency', 'Issuing agency is required'),
              ...need(/^\d{4}-\d{2}-\d{2}$/.test(verify.facility_license_expires), 'facility_license_expires', 'Expiration date is required'),
            }),
            save: verifyDraft(['facility_license_agency', 'facility_license_expires']),
            render: ({ errors }) => (
              <>
                <TextField id="facility_license_agency" label="Issuing agency" value={verify.facility_license_agency} onChange={(v) => setV('facility_license_agency', v)} error={errors.facility_license_agency} placeholder="e.g. CDPH" />
                <TextField id="facility_license_expires" label="Expiration date" type="date" value={verify.facility_license_expires} onChange={(v) => setV('facility_license_expires', v)} error={errors.facility_license_expires} />
              </>
            ),
          },
          {
            id: 'doc_facility_license',
            section: SECTION[3],
            title: 'Upload your facility license',
            sub: 'A PDF or a clear photo works.',
            fields: ['doc.facility_license'],
            validate: () => need(docs.some((d) => d.kind === 'facility_license'), 'doc.facility_license', 'Upload your facility license'),
            render: ({ errors }) => docSlot('facility_license', errors['doc.facility_license']),
          },
        ] satisfies Screen[])
      : []),
  ]

  // Company door: the lead person's credential, and LinkedIn.
  const companyScreens: Screen[] = [
    {
      id: 'lead_has_credential',
      section: SECTION[3],
      title: 'Does the lead person at your company hold a professional license or certification?',
      fields: ['lead_has_credential'],
      validate: () => need(!!verify.lead_has_credential, 'lead_has_credential', 'Answer yes or no'),
      save: verifyDraft(['lead_has_credential']),
      render: ({ errors, advance }) => (
        <IconChoices
          legend="Lead person's credential"
          hideLegend
          options={YES_NO}
          icons={YES_NO_ICONS}
          value={verify.lead_has_credential}
          onChange={(v) => {
            setV('lead_has_credential', v as YesNo)
            advance()
          }}
          error={errors.lead_has_credential}
          columns={2}
        />
      ),
    },
    ...(leadHasCredential
      ? ([
          {
            id: 'lead_credential',
            section: SECTION[3],
            title: 'What license or certification do they hold?',
            fields: ['lead_credential_type', 'lead_credential_number'],
            validate: () => ({
              ...need(!!verify.lead_credential_type.trim(), 'lead_credential_type', 'License or certification type is required'),
              ...need(!!verify.lead_credential_number.trim(), 'lead_credential_number', 'License or certification number is required'),
            }),
            save: verifyDraft(['lead_credential_type', 'lead_credential_number']),
            render: ({ errors }) => (
              <>
                <TextField id="lead_credential_type" label="License or certification type" value={verify.lead_credential_type} onChange={(v) => setV('lead_credential_type', v)} error={errors.lead_credential_type} placeholder="e.g. RN, bar admission, CPC" />
                <TextField id="lead_credential_number" label="License or certification number" value={verify.lead_credential_number} onChange={(v) => setV('lead_credential_number', v)} error={errors.lead_credential_number} />
              </>
            ),
          },
          {
            id: 'lead_credential_state',
            section: SECTION[3],
            title: 'Which state issued it?',
            fields: ['lead_credential_state'],
            validate: () => need(/^[A-Z]{2}$/.test(verify.lead_credential_state), 'lead_credential_state', 'Choose a state'),
            save: verifyDraft(['lead_credential_state']),
            render: ({ errors }) => (
              <SelectField id="lead_credential_state" label="State" value={verify.lead_credential_state} onChange={(v) => setV('lead_credential_state', v)} options={US_STATES} error={errors.lead_credential_state} />
            ),
          },
        ] satisfies Screen[])
      : []),
    {
      id: 'lead_linkedin',
      section: SECTION[3],
      title: 'What’s the lead person’s LinkedIn?',
      sub: verify.lead_has_credential === 'no' ? 'We use it to verify who runs the company.' : undefined,
      optional: verify.lead_has_credential !== 'no',
      fields: ['lead_linkedin'],
      validate: () => {
        const v = verify.lead_linkedin.trim()
        if (!v) return need(verify.lead_has_credential !== 'no', 'lead_linkedin', 'Add the lead person’s LinkedIn')
        return need(URL_LIKE.test(v), 'lead_linkedin', 'Enter a valid link, like linkedin.com/in/name')
      },
      save: verifyDraft(['lead_linkedin']),
      render: ({ errors }) => (
        <TextField id="lead_linkedin" label="LinkedIn profile" value={verify.lead_linkedin} onChange={(v) => setV('lead_linkedin', v)} error={errors.lead_linkedin} placeholder="linkedin.com/in/name" type="url" inputMode="url" autoComplete="url" />
      ),
    },
  ]

  const verifyScreens: Screen[] = [
    {
      id: 'legal_name',
      section: SECTION[3],
      title: 'What’s your legal business name?',
      sub: 'Only if it’s different from your organization name.',
      optional: true,
      fields: ['legal_name'],
      validate: () => verifyCheck(['legal_name']),
      save: verifyDraft(['legal_name']),
      render: ({ errors }) => (
        <TextField id="legal_name" label="Legal business name" value={verify.legal_name} onChange={(v) => setV('legal_name', v)} error={errors.legal_name} />
      ),
    },
    {
      id: 'business_structure',
      section: SECTION[3],
      title: 'How is your business structured?',
      fields: ['business_structure'],
      validate: () => verifyCheck(['business_structure']),
      save: verifyDraft(['business_structure']),
      render: ({ errors, advance }) => (
        <IconChoices
          legend="Business structure"
          hideLegend
          options={BUSINESS_STRUCTURES}
          icons={BUSINESS_STRUCTURE_ICONS}
          value={verify.business_structure}
          onChange={(v) => {
            setV('business_structure', v)
            advance()
          }}
          error={errors.business_structure}
          columns={2}
        />
      ),
    },
    {
      id: 'registration_state',
      section: SECTION[3],
      title: 'Which state is it registered in?',
      fields: ['registration_state'],
      validate: () => verifyCheck(['registration_state']),
      save: verifyDraft(['registration_state']),
      render: ({ errors }) => (
        <SelectField id="registration_state" label="State of registration" value={verify.registration_state} onChange={(v) => setV('registration_state', v)} options={US_STATES} error={errors.registration_state} />
      ),
    },
    ...(facility ? facilityScreens : companyScreens),
    {
      id: 'doc_business_registration',
      section: SECTION[3],
      title: 'Upload your business license or registration',
      sub: 'Your Secretary of State registration or business license. A PDF or a clear photo works.',
      fields: ['doc.business_registration'],
      validate: () =>
        need(docs.some((d) => d.kind === 'business_registration'), 'doc.business_registration', 'Upload your business license or Secretary of State registration'),
      render: ({ errors }) => docSlot('business_registration', errors['doc.business_registration']),
    },
    {
      id: 'org_npi',
      section: SECTION[3],
      title: 'Does your organization have an NPI?',
      sub: 'Your 10-digit National Provider Identifier, if you have one.',
      optional: true,
      fields: ['org_npi'],
      validate: () => verifyCheck(['org_npi']),
      save: verifyDraft(['org_npi']),
      render: ({ errors }) => (
        <div className="max-w-[260px]">
          <TextField id="org_npi" label="Organization NPI" value={verify.org_npi} onChange={(v) => setV('org_npi', v.replace(/\D/g, '').slice(0, 10))} error={errors.org_npi} inputMode="numeric" />
        </div>
      ),
    },
    ...ORG_DISCLOSURES.map((q, n): Screen => {
      const a = verify.disclosures[q.key] ?? { answer: '' as YesNo, details: '' }
      const key = `disclosures.${q.key}`
      return {
        id: `disc_${q.key}`,
        section: SECTION[3],
        title: q.question,
        sub: n === 0 ? 'A yes doesn’t automatically disqualify you. Just tell us what happened.' : undefined,
        fields: [key],
        validate: () =>
          !a.answer
            ? { [key]: 'Answer yes or no' }
            : a.answer === 'yes' && !a.details.trim()
              ? { [key]: 'Please explain' }
              : {},
        save: () => saveVerifyDraft({ disclosures: { [q.key]: a } }),
        render: ({ errors, advance }) => (
          <>
            <IconChoices
              legend={q.question}
              hideLegend
              options={YES_NO}
              icons={YES_NO_ICONS}
              value={a.answer}
              onChange={(v) => {
                setDisclosure(q.key, { answer: v as YesNo })
                if (v === 'no') advance()
              }}
              error={a.answer ? undefined : errors[key]}
              columns={2}
            />
            {a.answer === 'yes' && (
              <TextAreaField id={`disc-${q.key}`} label="Please explain" value={a.details} onChange={(v) => setDisclosure(q.key, { details: v })} maxLength={DISCLOSURE_DETAILS_MAX} rows={4} error={errors[key]} />
            )}
          </>
        ),
      }
    }),
    {
      id: 'attest',
      section: SECTION[3],
      title: 'Please confirm and authorize',
      sub: REVIEW_NOTE,
      fields: ['attest_authorized', 'attest_checks'],
      validate: () => ({
        ...need(verify.attest_authorized, 'attest_authorized', 'Please confirm you’re authorized and the information is accurate'),
        ...need(verify.attest_checks, 'attest_checks', 'Please authorize verification and exclusion screenings'),
      }),
      save: () => saveVerification(verify),
      render: ({ errors }) => (
        <div className="space-y-4 rounded-xl border border-[#e4e5e7] bg-white p-5">
          <CheckRow id="attest_authorized" checked={verify.attest_authorized} onChange={(v) => setV('attest_authorized', v)} label={ATTEST_AUTHORIZED_LABEL} error={errors.attest_authorized} />
          <CheckRow id="attest_checks" checked={verify.attest_checks} onChange={(v) => setV('attest_checks', v)} label={ATTEST_CHECKS_LABEL} error={errors.attest_checks} />
        </div>
      ),
    },
  ]

  /* ───────────── Step 4: Intents ───────────── */
  const intentScreens: Screen[] = [
    {
      id: 'intents',
      section: SECTION[4],
      title: 'What do you want to do on Sanus?',
      sub: 'Pick any. You can change this anytime.',
      fields: ['intents'],
      validate: () => need(intents.length > 0, 'intents', 'Pick at least one — you can change this anytime'),
      save: () => saveIntents(intents),
      render: ({ errors }) => (
        <IconMultiChoices
          legend="Goals"
          hideLegend
          options={ORG_INTENTS.map((o) => ({ value: o.key, label: o.label, sub: o.sub }))}
          icons={ORG_INTENT_ICONS}
          value={intents}
          onChange={(v) => setIntents(v as OrgIntent[])}
          error={errors.intents}
          columns={1}
        />
      ),
    },
  ]

  /* ───────────── Step 5: Quick setup ───────────── */
  const gate = (intent: OrgIntent, title: string, followUps: number): Screen => ({
    id: `gate_${intent}`,
    weight: setup[intent] === 'now' ? 1 : 1 + followUps,
    section: SECTION[5],
    title,
    sub: 'Nothing goes live until your organization is approved.',
    fields: [`gate.${intent}`],
    validate: () => need(!!setup[intent], `gate.${intent}`, 'Choose one to continue'),
    render: ({ errors, advance }) => (
      <IconChoices
        legend={title}
        hideLegend
        options={NOW_OR_LATER}
        icons={{ now: ORG_INTENT_ICONS[intent], later: Clock }}
        value={setup[intent] ?? ''}
        onChange={(v) => {
          setSetup((s) => ({ ...s, [intent]: v as SetupChoice }))
          advance()
        }}
        error={errors[`gate.${intent}`]}
        columns={2}
      />
    ),
  })
  const lookingCheck = (keys: (keyof LookingForData)[]) => checkFields(lookingForSchema.shape, keys, { ...lookingFor })
  // Saves once; going back afterwards won't create a duplicate draft.
  const saveOnce = (intent: OrgIntent, run: () => Promise<ActionResult>, msg: string) => async () => {
    if (saved[intent]) return OK
    const res = await run()
    if (res.ok) {
      setSaved((s) => ({ ...s, [intent]: true }))
      toast.success(msg)
    }
    return res
  }

  const serviceQs = serviceScreens({
    value: service,
    set: setS,
    section: SECTION[5],
    finish: saveOnce('advertise_services', () => saveListing('service', service), 'Service saved as a draft'),
  })
  const eventQs = eventScreens({
    value: event,
    set: setE,
    section: SECTION[5],
    // Send the time as ISO: the server runs in UTC and would misread a local time.
    finish: saveOnce(
      'host_events',
      () => saveListing('event', { ...event, starts_at: localInputToIso(event.starts_at) }),
      'Event saved as a draft'
    ),
  })

  const lookingScreens: Screen[] = [
    {
      id: 'lf_types',
      section: SECTION[5],
      title: 'What kinds of professionals are you looking for?',
      sub: 'Pick all that apply.',
      fields: ['types'],
      validate: () => lookingCheck(['types']),
      render: ({ errors }) => (
        <IconMultiChoices legend="Professional types" hideLegend options={PROFESSIONAL_TIERS} icons={PROFESSIONAL_TIER_ICONS} value={lookingFor.types} onChange={(x) => setL('types', x)} error={errors.types} columns={2} />
      ),
    },
    {
      id: 'lf_engagement',
      section: SECTION[5],
      title: 'How would they work with you?',
      sub: 'Pick all that apply.',
      fields: ['engagement_types'],
      validate: () => lookingCheck(['engagement_types']),
      render: ({ errors }) => (
        <IconMultiChoices legend="Engagement types" hideLegend options={LOOKING_FOR_ENGAGEMENTS} icons={ENGAGEMENT_ICONS} value={lookingFor.engagement_types} onChange={(x) => setL('engagement_types', x)} error={errors.engagement_types} columns={2} />
      ),
    },
    {
      id: 'lf_setting',
      section: SECTION[5],
      title: 'Where, and how soon?',
      fields: ['settings', 'timeline'],
      validate: () => lookingCheck(['settings', 'timeline']),
      render: ({ errors }) => (
        <>
          <IconMultiChoices legend="Setting" options={WORK_SETTINGS} icons={FORMAT_ICONS} value={lookingFor.settings} onChange={(x) => setL('settings', x)} error={errors.settings} compact />
          <IconChoices legend="Timeline" options={HIRING_TIMELINES} icons={TIMELINE_ICONS} value={lookingFor.timeline} onChange={(x) => setL('timeline', x)} error={errors.timeline} compact />
        </>
      ),
    },
    {
      id: 'lf_details',
      section: SECTION[5],
      title: 'Any specialties or experience you need?',
      optional: true,
      fields: ['specialties', 'min_years'],
      validate: () => lookingCheck(['specialties', 'min_years']),
      save: saveOnce('find_professionals', () => saveLookingFor(lookingFor), 'Saved — we’ll use this to suggest professionals'),
      continueLabel: 'Save',
      render: ({ errors }) => (
        <>
          <TextField id="lf-specialties" label="Specialties" hint="Separate with commas, e.g. pediatrics, IV therapy" value={lookingFor.specialties} onChange={(x) => setL('specialties', x)} error={errors.specialties} />
          <div className="max-w-[260px]">
            <TextField id="lf-years" label="Minimum years of experience" value={lookingFor.min_years} onChange={(x) => setL('min_years', x.replace(/\D/g, '').slice(0, 2))} error={errors.min_years} inputMode="numeric" />
          </div>
        </>
      ),
    },
  ]

  const setupScreens: Screen[] = ORG_INTENTS.filter((o) => intents.includes(o.key)).flatMap((o): Screen[] => {
    const now = setup[o.key] === 'now'
    switch (o.key) {
      case 'advertise_services':
        return [gate(o.key, 'Want to add your first service now?', serviceQs.length), ...(now ? serviceQs : [])]
      case 'host_events':
        return [gate(o.key, 'Want to add your first event now?', eventQs.length), ...(now ? eventQs : [])]
      case 'find_professionals':
        return [gate(o.key, 'Want to tell us who you’re looking for?', lookingScreens.length), ...(now ? lookingScreens : [])]
      case 'post_needs':
        return STAFFING_POSTS_ENABLED
          ? [
              gate(o.key, 'Want to post a staffing need now?', 1),
              ...(now
                ? [
                    {
                      id: 'staffing',
                      section: SECTION[5],
                      title: 'Post a staffing need',
                      render: () => (
                        <StaffingForm
                          defaults={{ city: about.city, state: about.state, zip_code: about.zip_code }}
                          onSaved={() => setSaved((s) => ({ ...s, post_needs: true }))}
                        />
                      ),
                    } satisfies Screen,
                  ]
                : []),
            ]
          : [
              {
                id: 'staffing_soon',
                section: SECTION[5],
                title: 'Posting staffing needs is coming soon',
                sub: 'We’ll let you know as soon as it’s available. Nothing to do here for now.',
                render: () => null,
              },
            ]
    }
  })

  const submitScreen: Screen = {
    id: 'submit',
    section: 'Review',
    title: 'You’re all set. Submit for review?',
    sub: `${REVIEW_NOTE} We’ll email you as soon as you’re approved.`,
    continueLabel: 'Submit for review',
    save: async () => {
      const res = await finishOnboarding()
      if (res.ok) toast.success('Application submitted. We’ll email you within 24-48 hours.')
      return res
    },
    render: () => (
      <ul className="space-y-2.5 rounded-xl border border-[#e4e5e7] bg-white p-5 text-sm text-[#404145]">
        <li>✓ About {about.facility_name || 'your organization'}</li>
        <li>✓ Verification details and documents</li>
        <li>✓ Your goals on Sanus</li>
        {Object.entries(saved)
          .filter(([, v]) => v)
          .map(([k]) => (
            <li key={k}>✓ {ORG_INTENTS.find((o) => o.key === k)?.label} (saved as a draft)</li>
          ))}
      </ul>
    ),
  }

  const steps: Record<OrgWizardStep, Screen[]> = {
    2: aboutScreens,
    3: verifyScreens,
    4: intentScreens,
    5: [...setupScreens, submitScreen],
  }
  const screens = ([2, 3, 4, 5] as const).flatMap((n) => steps[n].map((sc) => ({ ...sc, step: n })))

  // Resume at the first unanswered question, but never past the saved step:
  // that step's closing save hasn't run yet. Computed once, from the
  // server-loaded answers.
  const initialIndex = useMemo(() => {
    const before = ([2, 3, 4, 5] as const).filter((s) => s < initialStep).reduce((n, s) => n + steps[s].length, 0)
    const own = steps[initialStep]
    const firstOpen = own.findIndex((s) => Object.keys(s.validate?.() ?? {}).length > 0)
    return before + (firstOpen === -1 ? own.length - 1 : firstOpen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <QuestionFlow
      screens={screens}
      initialIndex={initialIndex}
      // Full load so the dashboard (and proxy) see the submitted state.
      onFinish={() => window.location.assign('/dashboard')}
    />
  )
}
