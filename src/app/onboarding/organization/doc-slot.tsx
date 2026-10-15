'use client'

import { useRef, useState } from 'react'
import { FileText, Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/data'
import { CREDENTIALS_BUCKET } from '@/lib/credentials/document'
import type { OrgDocumentKind } from '@/lib/onboarding/organization'
import { FieldError } from '../professional/ui'
import { recordOrgDocument, removeOrgDocument } from './actions'
import { DOC_ALLOWED_TYPES, DOC_MAX_BYTES, type OrgDoc } from './shared'

/** One upload slot (uploads go straight to storage and are recorded at once). */
export function DocSlot({
  userId,
  kind,
  label,
  docs,
  onAdded,
  onRemoved,
  error,
}: {
  userId: string
  kind: OrgDocumentKind
  label: string
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
    <div className="space-y-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-white px-6 py-10 text-center transition hover:border-[#1dbf73] hover:bg-[#f0faf5] focus-visible:ring-3 focus-visible:ring-[#1dbf73]/30 focus-visible:outline-none disabled:opacity-70 ${
          error ? 'border-red-300' : 'border-[#d5d6d9]'
        }`}
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-[#e8faf1] text-[#1dbf73]">
          {busy ? <Loader2 className="size-6 animate-spin" /> : <Upload className="size-6" />}
        </span>
        <span>
          <span className="block text-base font-semibold text-[#404145]">
            {busy ? 'Uploading…' : docs.length ? 'Upload another file' : 'Choose a file to upload'}
          </span>
          <span className="mt-1 block text-sm text-[#62646a]">PDF, JPG, PNG, GIF or WebP, up to 10 MB</span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={DOC_ALLOWED_TYPES.join(',')}
        className="hidden"
        aria-label={`Upload ${label}`}
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
      {docs.length > 0 && (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-[#bcebd5] bg-[#f0faf5] px-4 py-3 text-sm text-[#404145]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="size-4 shrink-0 text-[#1dbf73]" />
                <span className="truncate font-medium">{d.filename}</span>
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
