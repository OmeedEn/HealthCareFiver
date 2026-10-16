'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Camera, CheckCircle2, FileUp, Loader2, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/data'
import { CREDENTIALS_BUCKET } from '@/lib/credentials/document'
import { recordDocument } from '@/app/onboarding/professional/actions'
import {
  DOC_MIME,
  DOCX_MIME,
  MAX_DOC_BYTES,
  type DocSlotKey,
  type UploadedDoc,
} from '@/app/onboarding/professional/shared'

/** Storage-safe object name: `{uuid}-{sanitized original name}` */
function objectName(file: File): string {
  const safe =
    file.name
      .normalize('NFKD')
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/^[._]+/, '')
      .slice(-100) || 'document'
  return `${crypto.randomUUID()}-${safe}`
}

/**
 * One upload on a single-question screen: "Take a photo" (opens the rear
 * camera on phones) or "Choose a file". Files go straight to the PRIVATE
 * credentials bucket under the person's own folder; the server action then
 * records the credential row (pending review).
 */
export function DocumentUpload({
  userId,
  slot,
  doc,
  onUploaded,
  acceptsDocx = false,
}: {
  userId: string
  slot: DocSlotKey
  doc: UploadedDoc | undefined
  onUploaded: (doc: UploadedDoc, replacedId: string | null) => void
  /** Resumes / CVs may be Word documents. */
  acceptsDocx?: boolean
}) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const allowed = acceptsDocx ? [...DOC_MIME, ...DOCX_MIME] : DOC_MIME
  const accept = `image/*,application/pdf${acceptsDocx ? ',.doc,.docx' : ''}`
  const verified = doc?.status === 'verified'

  async function handleFile(input: HTMLInputElement | null) {
    const file = input?.files?.[0] ?? null
    if (input) input.value = ''
    if (!file) return
    if (!allowed.includes(file.type)) {
      toast.error(
        acceptsDocx
          ? 'Use a photo (JPG, PNG, GIF, WebP), a PDF, or a Word document.'
          : 'Use a photo (JPG, PNG, GIF, WebP) or a PDF.'
      )
      return
    }
    if (file.size > MAX_DOC_BYTES) {
      toast.error('File must be 10 MB or smaller.')
      return
    }
    setBusy(true)
    try {
      const path = `${userId}/${objectName(file)}`
      if (!isDemoMode()) {
        const { error } = await createClient()
          .storage.from(CREDENTIALS_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false })
        if (error) {
          toast.error('Upload failed. Please try again.')
          return
        }
      }
      const replaceId = doc && !verified ? doc.id : null
      const res = await recordDocument({ slot, path, filename: file.name, replaceId })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      onUploaded(res.doc, replaceId)
    } catch {
      toast.error('Upload failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const btn =
    'flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition outline-none focus-visible:ring-3 focus-visible:ring-[#1dbf73]/30 disabled:opacity-60'

  return (
    <div className="space-y-3">
      <input
        ref={cameraRef}
        id={`${slot}-camera`}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void handleFile(e.currentTarget)}
        disabled={busy}
      />
      <input
        ref={fileRef}
        id={`${slot}-file`}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void handleFile(e.currentTarget)}
        disabled={busy}
      />

      {doc && (
        <div className="flex items-center gap-3 rounded-xl border border-[#bcebd5] bg-[#f4fcf8] p-3.5 text-sm" role="status">
          <CheckCircle2 className="size-5 shrink-0 text-[#1dbf73]" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-[#0f4c3a]">
            {verified ? 'Verified' : 'Uploaded'}
            {doc.document_filename ? ` · ${doc.document_filename}` : ''}
          </span>
        </div>
      )}

      {!verified && (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            className={`${btn} border-[#1dbf73] bg-[#e8faf1] text-[#0f4c3a] hover:bg-[#d9f6e8]`}
            onClick={() => cameraRef.current?.click()}
            disabled={busy}
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Camera className="size-4" aria-hidden />}
            {doc ? 'Retake photo' : 'Take a photo'}
          </button>
          <button
            type="button"
            className={`${btn} border-[#e4e5e7] bg-white text-[#404145] hover:border-[#bcebd5]`}
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <FileUp className="size-4" aria-hidden />
            {doc ? 'Choose a different file' : 'Choose a file'}
          </button>
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-[#95979d]">
        <Lock className="size-3.5" aria-hidden /> Private and encrypted. PDF or photo, up to 10 MB.
      </p>
    </div>
  )
}
