'use client'

import { useRef, useState } from 'react'
import { FileText, Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/data'
import { US_STATES } from '@/lib/utils/constants'
import { CREDENTIALS_BUCKET } from '@/lib/credentials/document'
import {
  ATTEST_AUTHORIZED_LABEL,
  ATTEST_CHECKS_LABEL,
  BUSINESS_STRUCTURES,
  DISCLOSURE_DETAILS_MAX,
  ORG_DISCLOSURES,
  ORG_DOCUMENT_KINDS,
  REVIEW_NOTE,
  type OrgDocumentKind,
} from '@/lib/onboarding/organization'
import {
  CheckRow,
  FieldError,
  PRIMARY_BTN,
  RadioCards,
  SelectField,
  StepHeading,
  TextAreaField,
  TextField,
  YES_NO_OPTIONS,
} from '../professional/ui'
import { recordOrgDocument, removeOrgDocument, saveVerification } from './actions'
import { DOC_ALLOWED_TYPES, DOC_MAX_BYTES, type OrgDoc, type VerifyData, type YesNo } from './shared'

export function StepVerify({
  userId,
  value,
  onChange,
  docs,
  onDocsChange,
  onBack,
  onDone,
}: {
  userId: string
  value: VerifyData
  onChange: (v: VerifyData) => void
  docs: OrgDoc[]
  onDocsChange: (d: OrgDoc[]) => void
  onBack: () => void
  onDone: () => void
}) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof VerifyData>(k: K, v: VerifyData[K]) => onChange({ ...value, [k]: v })
  const setDisclosure = (key: string, patch: Partial<{ answer: YesNo; details: string }>) =>
    set('disclosures', {
      ...value.disclosures,
      [key]: { ...(value.disclosures[key] ?? { answer: '', details: '' }), ...patch },
    })

  const hasLicense = value.has_facility_license === 'yes'

  async function next() {
    setSaving(true)
    const res = await saveVerification(value)
    setSaving(false)
    if (!res.ok) {
      setErrors(res.fields ?? {})
      toast.error(res.error)
      return
    }
    setErrors({})
    onDone()
  }

  return (
    <div className="space-y-8">
      <StepHeading title="Verify your organization" sub={REVIEW_NOTE} />

      <section className="space-y-4">
        <TextField
          id="legal_name"
          label="Legal business name"
          optional
          hint="Only if it’s different from your organization name."
          value={value.legal_name}
          onChange={(v) => set('legal_name', v)}
          error={errors.legal_name}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            id="business_structure"
            label="Business structure"
            value={value.business_structure}
            onChange={(v) => set('business_structure', v)}
            options={BUSINESS_STRUCTURES}
            error={errors.business_structure}
          />
          <SelectField
            id="registration_state"
            label="State of registration"
            value={value.registration_state}
            onChange={(v) => set('registration_state', v)}
            options={US_STATES}
            error={errors.registration_state}
          />
        </div>
      </section>

      <section className="space-y-4">
        <RadioCards
          name="has_facility_license"
          legend="Does your organization hold a facility or operating license?"
          options={YES_NO_OPTIONS}
          value={value.has_facility_license}
          onChange={(v) => set('has_facility_license', v)}
          error={errors.has_facility_license}
          columns={2}
        />
        {hasLicense && (
          <div className="grid gap-3 rounded-lg border border-[#e4e5e7] bg-white p-4 sm:grid-cols-2">
            <TextField id="facility_license_type" label="License type" value={value.facility_license_type} onChange={(v) => set('facility_license_type', v)} error={errors.facility_license_type} placeholder="e.g. Primary care clinic" />
            <TextField id="facility_license_number" label="License number" value={value.facility_license_number} onChange={(v) => set('facility_license_number', v)} error={errors.facility_license_number} />
            <TextField id="facility_license_agency" label="Issuing agency" value={value.facility_license_agency} onChange={(v) => set('facility_license_agency', v)} error={errors.facility_license_agency} placeholder="e.g. CDPH" />
            <TextField id="facility_license_expires" label="Expiration date" type="date" value={value.facility_license_expires} onChange={(v) => set('facility_license_expires', v)} error={errors.facility_license_expires} />
          </div>
        )}
        <div className="max-w-[260px]">
          <TextField
            id="org_npi"
            label="Organization NPI"
            optional
            value={value.org_npi}
            onChange={(v) => set('org_npi', v.replace(/\D/g, '').slice(0, 10))}
            error={errors.org_npi}
            inputMode="numeric"
          />
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="text-base font-semibold text-[#404145]">A few yes/no questions</h2>
          <p className="text-sm text-[#62646a]">If you answer yes, tell us what happened. A yes doesn’t automatically disqualify you.</p>
        </div>
        {ORG_DISCLOSURES.map((q) => {
          const a = value.disclosures[q.key] ?? { answer: '' as YesNo, details: '' }
          return (
            <div key={q.key} className="space-y-2">
              <RadioCards
                name={`disc-${q.key}`}
                legend={q.question}
                options={YES_NO_OPTIONS}
                value={a.answer}
                onChange={(v) => setDisclosure(q.key, { answer: v })}
                columns={2}
              />
              {a.answer === 'yes' && (
                <TextAreaField
                  id={`disc-${q.key}-details`}
                  label="Please explain"
                  value={a.details}
                  onChange={(v) => setDisclosure(q.key, { details: v })}
                  maxLength={DISCLOSURE_DETAILS_MAX}
                />
              )}
              <FieldError msg={errors[`disclosures.${q.key}`]} />
            </div>
          )
        })}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[#404145]">Documents</h2>
        {ORG_DOCUMENT_KINDS.filter((k) => k.kind !== 'facility_license' || hasLicense).map((k) => (
          <DocSlot
            key={k.kind}
            userId={userId}
            kind={k.kind}
            label={k.label}
            help={k.help}
            docs={docs.filter((d) => d.kind === k.kind)}
            onAdded={(doc) => onDocsChange([...docs, doc])}
            onRemoved={(id) => onDocsChange(docs.filter((d) => d.id !== id))}
            error={errors[`doc.${k.kind}`]}
          />
        ))}
      </section>

      <section className="space-y-3 rounded-lg border border-[#e4e5e7] bg-white p-4">
        <CheckRow
          id="attest_authorized"
          checked={value.attest_authorized}
          onChange={(v) => set('attest_authorized', v)}
          label={ATTEST_AUTHORIZED_LABEL}
          error={errors.attest_authorized}
        />
        <CheckRow
          id="attest_checks"
          checked={value.attest_checks}
          onChange={(v) => set('attest_checks', v)}
          label={ATTEST_CHECKS_LABEL}
          error={errors.attest_checks}
        />
      </section>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack} className="h-11">
          Back
        </Button>
        <Button type="button" onClick={next} disabled={saving} className={PRIMARY_BTN}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Continue
        </Button>
      </div>
    </div>
  )
}

function DocSlot({
  userId,
  kind,
  label,
  help,
  docs,
  onAdded,
  onRemoved,
  error,
}: {
  userId: string
  kind: OrgDocumentKind
  label: string
  help: string
  docs: OrgDoc[]
  onAdded: (d: OrgDoc) => void
  onRemoved: (id: string) => void
  error?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(file: File | null) {
    if (inputRef.current) inputRef.current.value = ''
    if (!file) return
    if (!DOC_ALLOWED_TYPES.includes(file.type)) {
      toast.error('File must be a PDF, JPG, PNG, GIF, or WebP')
      return
    }
    if (file.size > DOC_MAX_BYTES) {
      toast.error('File must be 10 MB or smaller')
      return
    }
    setBusy(true)
    try {
      const safe = file.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-100)
      const path = `${userId}/org/${kind}/${Date.now()}-${safe}`
      if (!isDemoMode()) {
        const { error: upErr } = await createClient()
          .storage.from(CREDENTIALS_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false })
        if (upErr) {
          toast.error(`Upload failed: ${upErr.message}`)
          return
        }
      }
      const res = await recordOrgDocument({ kind, path, filename: file.name })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      onAdded(res.doc)
      toast.success(`${label} uploaded`)
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    const res = await removeOrgDocument(id)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    onRemoved(id)
  }

  return (
    <div className={`rounded-lg border bg-white p-4 ${error ? 'border-red-300' : 'border-[#e4e5e7]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#404145]">{label}</p>
          <p className="text-xs text-[#62646a]">{help}</p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Upload className="mr-1.5 size-3.5" />}
          Upload
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={DOC_ALLOWED_TYPES.join(',')}
          className="hidden"
          aria-label={`Upload ${label}`}
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>
      {docs.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 text-sm text-[#404145]">
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="size-4 shrink-0 text-[#1dbf73]" />
                <span className="truncate">{d.filename}</span>
              </span>
              <button type="button" onClick={() => remove(d.id)} className="text-[#95979d] hover:text-red-600" aria-label={`Remove ${d.filename}`}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <FieldError msg={error} />
    </div>
  )
}
