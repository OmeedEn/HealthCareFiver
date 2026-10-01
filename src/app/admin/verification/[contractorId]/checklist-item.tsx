'use client'

import { useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { CheckCircle2, Circle, ExternalLink, Loader2, Paperclip, Upload } from 'lucide-react'
import type { ChecklistEntry, ChecklistItemDef, EvidenceItem } from '../_lib/shared'

export interface ChecklistItemProps {
  contractorId: string
  def: ChecklistItemDef
  entry: ChecklistEntry | undefined
  evidence: EvidenceItem[]
  adminNames: Record<string, string>
  demo: boolean
  onSaved: (key: string, entry: ChecklistEntry) => void
  onEvidence: (item: EvidenceItem) => void
}

/** Save one admin_checklist entry. Returns the stored entry or throws. */
export async function saveChecklistEntry(
  contractorId: string,
  key: string,
  done: boolean,
  note: string | null
): Promise<ChecklistEntry> {
  const res = await fetch(`/api/admin/verification/${contractorId}/checklist`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, done, note }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Failed to save')
  return data.entry as ChecklistEntry
}

export function ChecklistItem({
  contractorId,
  def,
  entry,
  evidence,
  adminNames,
  demo,
  onSaved,
  onEvidence,
}: ChecklistItemProps) {
  const [note, setNote] = useState(entry?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const done = !!entry?.done

  async function save(nextDone: boolean) {
    const trimmed = note.trim() || null
    if (demo) {
      onSaved(def.key, { done: nextDone, by: 'demo', at: new Date().toISOString(), note: trimmed })
      toast.info('Demo mode — not saved')
      return
    }
    setSaving(true)
    try {
      onSaved(def.key, await saveChecklistEntry(contractorId, def.key, nextDone, trimmed))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function upload(file: File) {
    if (demo) {
      toast.info('Demo mode — evidence is not uploaded')
      return
    }
    setUploading(true)
    try {
      const signRes = await fetch(
        `/api/admin/verification/${contractorId}/evidence/upload-url`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            checkKey: def.key,
            filename: file.name,
            contentType: file.type,
            size: file.size,
          }),
        }
      )
      const signed = await signRes.json().catch(() => ({}))
      if (!signRes.ok) throw new Error(signed.error ?? 'Could not start the upload')

      const { error: upErr } = await createClient()
        .storage.from(signed.bucket)
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type })
      if (upErr) throw new Error('Upload failed — try again')

      const recRes = await fetch(`/api/admin/verification/${contractorId}/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkKey: def.key, path: signed.path, note: note.trim() || null }),
      })
      const rec = await recRes.json().catch(() => ({}))
      if (!recRes.ok) throw new Error(rec.error ?? 'Failed to save evidence')

      onEvidence({
        id: rec.evidence.id,
        check_key: def.key,
        note: rec.evidence.note,
        created_by: rec.evidence.created_by,
        created_at: rec.evidence.created_at,
        filename: file.name,
      })
      toast.success('Evidence saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const missingEvidence = def.needsEvidence && done && evidence.length === 0

  return (
    <li
      className={cn(
        'rounded-lg border p-3',
        done ? 'border-green-200 bg-green-50/50' : 'border-border'
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => save(!done)}
          className="mt-0.5 shrink-0"
          aria-label={done ? 'Mark not done' : 'Mark done'}
        >
          {saving ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : done ? (
            <CheckCircle2 className="size-5 text-green-600" />
          ) : (
            <Circle className="size-5 text-muted-foreground" />
          )}
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{def.label}</span>
            {def.needsEvidence && (
              <Badge variant={missingEvidence ? 'destructive' : 'outline'}>
                {missingEvidence ? 'Evidence missing' : 'Screenshot/PDF required'}
              </Badge>
            )}
          </div>
          {def.help && <p className="text-xs text-muted-foreground">{def.help}</p>}
          {def.links && def.links.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {def.links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#1dbf73] hover:underline"
                >
                  {l.label}
                  <ExternalLink className="size-3" />
                </a>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (what you checked, result)"
              className="h-8 min-w-48 flex-1 text-xs"
            />
            <Button
              size="xs"
              variant="outline"
              disabled={saving || (note.trim() || null) === (entry?.note ?? null)}
              onClick={() => save(done)}
            >
              Save note
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) upload(f)
              }}
            />
            <Button
              size="xs"
              variant="outline"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="size-3 animate-spin" data-icon="inline-start" />
              ) : (
                <Upload className="size-3" data-icon="inline-start" />
              )}
              Add evidence
            </Button>
          </div>
          {entry?.at && (
            <p className="text-xs text-muted-foreground">
              {entry.done ? 'Done' : 'Updated'} {formatDateTime(entry.at)}
              {entry.by ? ` by ${adminNames[entry.by] ?? entry.by}` : ''}
            </p>
          )}
          {evidence.length > 0 && (
            <ul className="space-y-1">
              {evidence.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <Paperclip className="size-3 text-muted-foreground" />
                  {demo ? (
                    <span className="font-medium">{e.filename}</span>
                  ) : (
                    <a
                      href={`/api/admin/verification/${contractorId}/evidence/${e.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline"
                    >
                      {e.filename}
                    </a>
                  )}
                  <span className="text-muted-foreground">
                    captured {formatDateTime(e.created_at)}
                    {e.created_by ? ` by ${adminNames[e.created_by] ?? e.created_by}` : ''}
                  </span>
                  {e.note && <span className="text-muted-foreground">— {e.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  )
}
