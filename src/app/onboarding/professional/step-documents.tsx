'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/data'
import { CREDENTIALS_BUCKET } from '@/lib/credentials/document'
import { recordDocument, removeDocument, submitDocuments } from './actions'
import {
  DOC_MIME,
  DOCX_MIME,
  MAX_DOC_BYTES,
  REVIEW_NOTE,
  docSlotsFor,
  type DocSlot,
  type ProCategory,
  type UploadedDoc,
} from './shared'
import { PRIMARY_BTN, StepHeading } from './ui'

/** Storage-safe object name: `{uuid}-{sanitized original name}` */
function objectName(file: File): string {
  const safe = file.name
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^[._]+/, '')
    .slice(-100) || 'document'
  return `${crypto.randomUUID()}-${safe}`
}

function docForSlot(slot: DocSlot, docs: UploadedDoc[]): UploadedDoc | undefined {
  // Prefer the slot's own credential_type, then any type that satisfies it.
  const usable = docs.filter((d) => d.document_url && d.status !== 'rejected')
  return (
    usable.find((d) => d.credential_type === slot.credentialType) ??
    usable.find((d) => slot.matches.includes(d.credential_type as DocSlot['credentialType']))
  )
}

export function StepDocuments({
  userId,
  category,
  docs,
  setDocs,
  onBack,
  onSaved,
}: {
  userId: string
  category: ProCategory
  docs: UploadedDoc[]
  setDocs: React.Dispatch<React.SetStateAction<UploadedDoc[]>>
  onBack: () => void
  onSaved: () => void
}) {
  const slots = docSlotsFor(category)
  const [pending, startTransition] = useTransition()
  const missing = slots.filter((s) => s.required && !docForSlot(s, docs))

  function submit() {
    if (missing.length > 0) {
      toast.error(`Please upload: ${missing.map((m) => m.label).join(', ')}.`)
      return
    }
    startTransition(async () => {
      const res = await submitDocuments()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      onSaved()
    })
  }

  return (
    <div>
      <StepHeading
        title="Upload your documents"
        sub="PDF, JPG, PNG, GIF, or WebP, up to 10 MB each. Documents are private: only our verification team can see them."
      />

      <div className="mt-6 space-y-3">
        {slots.map((slot) => (
          <DocSlotRow
            key={slot.key}
            slot={slot}
            userId={userId}
            doc={docForSlot(slot, docs)}
            onUploaded={(doc, replacedId) =>
              setDocs((prev) => [doc, ...prev.filter((d) => d.id !== replacedId)])
            }
            onRemoved={(id) => setDocs((prev) => prev.filter((d) => d.id !== id))}
          />
        ))}
      </div>

      <p className="mt-5 rounded-lg bg-[#f7f7f7] p-3 text-center text-sm text-[#62646a]">
        {REVIEW_NOTE}
      </p>

      <div className="mt-8 flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="h-11 flex-1">
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={submit}
          disabled={pending || missing.length > 0}
          className={`flex-1 ${PRIMARY_BTN}`}
        >
          {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Continue
          <ArrowRight className="ml-2 size-4" />
        </Button>
      </div>
    </div>
  )
}

function DocSlotRow({
  slot,
  userId,
  doc,
  onUploaded,
  onRemoved,
}: {
  slot: DocSlot
  userId: string
  doc: UploadedDoc | undefined
  onUploaded: (doc: UploadedDoc, replacedId: string | null) => void
  onRemoved: (id: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<null | 'upload' | 'remove'>(null)
  const allowed = slot.acceptsDocx ? [...DOC_MIME, ...DOCX_MIME] : DOC_MIME
  const accept = `.pdf,.png,.jpg,.jpeg,.gif,.webp${slot.acceptsDocx ? ',.doc,.docx' : ''}`
  const verified = doc?.status === 'verified'
  const inputId = `doc-${slot.key}`

  async function handleFile(file: File | null) {
    if (inputRef.current) inputRef.current.value = ''
    if (!file) return
    if (!allowed.includes(file.type)) {
      toast.error(
        slot.acceptsDocx
          ? 'File must be a PDF, Word document, JPG, PNG, GIF, or WebP'
          : 'File must be a PDF, JPG, PNG, GIF, or WebP'
      )
      return
    }
    if (file.size > MAX_DOC_BYTES) {
      toast.error('File must be 10 MB or smaller')
      return
    }

    setBusy('upload')
    try {
      const path = `${userId}/${objectName(file)}`
      if (!isDemoMode()) {
        const supabase = createClient()
        const { error } = await supabase.storage
          .from(CREDENTIALS_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false })
        if (error) {
          toast.error(`Upload failed: ${error.message}`)
          return
        }
      }
      const replaceId = doc && !verified ? doc.id : null
      const res = await recordDocument({
        slot: slot.key,
        path,
        filename: file.name,
        replaceId,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      onUploaded(res.doc, replaceId)
      toast.success(`${slot.label} uploaded`)
    } catch (err) {
      console.error(err)
      toast.error('Upload failed. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  async function handleRemove() {
    if (!doc) return
    setBusy('remove')
    try {
      const res = await removeDocument(doc.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      onRemoved(doc.id)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      className={`rounded-xl border p-4 ${
        doc ? 'border-[#bcebd5] bg-[#f4fcf8]' : 'border-[#e4e5e7] bg-white'
      }`}
    >
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        disabled={busy !== null}
      />
      <div className="flex items-start gap-3">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
            doc ? 'bg-[#1dbf73] text-white' : 'bg-[#f7f7f7] text-[#62646a]'
          }`}
        >
          {doc ? <CheckCircle2 className="size-5" /> : <FileText className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#404145]">
            {slot.label}
            {!slot.required && (
              <span className="ml-1 font-normal text-[#95979d]">(optional)</span>
            )}
          </p>
          {doc ? (
            <p className="mt-0.5 truncate text-xs text-[#0f8f56]">
              {verified ? 'Verified' : 'Uploaded'}
              {doc.document_filename ? ` · ${doc.document_filename}` : ''}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-[#62646a]">{slot.hint}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 sm:pl-[52px]">
        {!doc && (
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null}
            onClick={() => inputRef.current?.click()}
            className="h-9"
          >
            {busy === 'upload' ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Upload className="mr-1.5 size-4" />
            )}
            {busy === 'upload' ? 'Uploading…' : 'Upload file'}
          </Button>
        )}
        {doc && !verified && (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() => inputRef.current?.click()}
              className="h-9"
            >
              {busy === 'upload' ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 size-4" />
              )}
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy !== null}
              onClick={handleRemove}
              className="h-9 text-[#c0392b] hover:bg-[#fdecec] hover:text-[#c0392b]"
            >
              {busy === 'remove' ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 size-4" />
              )}
              Remove
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
