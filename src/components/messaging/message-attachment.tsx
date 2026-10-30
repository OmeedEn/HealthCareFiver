'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  MESSAGE_ATTACHMENTS_BUCKET,
  type AttachmentType,
} from '@/lib/messaging/attachments'
import { FileTextIcon, Loader2Icon } from 'lucide-react'
import { cn } from '@/lib/utils'

const TTL_SECONDS = 60 * 60
const cache = new Map<string, { url: string; expires: number }>()

async function signedUrl(path: string): Promise<string | null> {
  const hit = cache.get(path)
  if (hit && hit.expires > Date.now() + 60_000) return hit.url
  const { data, error } = await createClient()
    .storage.from(MESSAGE_ATTACHMENTS_BUCKET)
    .createSignedUrl(path, TTL_SECONDS)
  if (error || !data?.signedUrl) return null
  cache.set(path, { url: data.signedUrl, expires: Date.now() + TTL_SECONDS * 1000 })
  return data.signedUrl
}

function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MessageAttachmentView({
  path,
  type,
  name,
  size,
  own,
}: {
  path: string
  type: AttachmentType
  name: string | null
  size: number | null
  own?: boolean
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    signedUrl(path).then((u) => {
      if (cancelled) return
      if (u) setUrl(u)
      else setFailed(true)
    })
    return () => {
      cancelled = true
    }
  }, [path])

  if (failed) {
    return <p className="text-xs opacity-70">Attachment unavailable</p>
  }
  if (!url) {
    return (
      <div className="flex h-20 w-40 items-center justify-center">
        <Loader2Icon className="size-4 animate-spin opacity-60" />
      </div>
    )
  }

  if (type === 'image') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element -- signed, expiring storage URL */}
        <img
          src={url}
          alt={name ?? 'Photo'}
          className="max-h-72 max-w-full rounded-lg object-contain"
        />
      </a>
    )
  }

  if (type === 'video') {
    return (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className="max-h-80 max-w-full rounded-lg bg-black"
      />
    )
  }

  if (type === 'audio') {
    return <audio src={url} controls preload="metadata" className="w-64 max-w-full" />
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:underline',
        own ? 'border-white/30' : 'border-[#e4e5e7] bg-white'
      )}
    >
      <FileTextIcon className="size-4 shrink-0" />
      <span className="truncate">{name ?? 'Document'}</span>
      <span className="shrink-0 text-xs opacity-70">{formatSize(size)}</span>
    </a>
  )
}
