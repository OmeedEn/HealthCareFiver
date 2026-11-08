'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/data'

const BUCKET = 'professional-photos'
const MAX_PHOTOS = 12
const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

type Photo = {
  id: string
  storage_path: string
  url: string
  caption: string | null
  sort_order: number
}

/**
 * Photo gallery on the public profile. Files go to the public
 * `professional-photos` bucket at `{user_id}/{timestamp}.{ext}`; rows in
 * professional_photos hold order and captions. Changes save right away.
 */
export function PhotoManager() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (isDemoMode()) {
        setState('ready')
        return
      }
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return
      setUserId(user.id)
      const { data, error } = await supabase
        .from('professional_photos')
        .select('id, storage_path, url, caption, sort_order')
        .eq('contractor_id', user.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (cancelled) return
      if (error) {
        // Table not migrated yet.
        setState('unavailable')
        return
      }
      setPhotos((data ?? []) as Photo[])
      setState('ready')
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    if (isDemoMode()) {
      toast.success('Photos added (demo)')
      return
    }
    if (!userId) return
    const room = MAX_PHOTOS - photos.length
    if (room <= 0) {
      toast.error(`You can add up to ${MAX_PHOTOS} photos.`)
      return
    }
    const queue = files.slice(0, room)
    if (files.length > room) toast.message(`Only the first ${room} will be added (limit ${MAX_PHOTOS}).`)

    setBusy(true)
    const supabase = createClient()
    let next = photos.reduce((m, p) => Math.max(m, p.sort_order), -1) + 1
    const added: Photo[] = []
    for (const file of queue) {
      const ext = ALLOWED_TYPES[file.type]
      if (!ext) {
        toast.error(`${file.name}: use a JPG, PNG, or WebP image.`)
        continue
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: photos must be 8 MB or smaller.`)
        continue
      }
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) {
        console.error('[photos] upload failed', upErr)
        toast.error(`Couldn't upload ${file.name}. Please try again.`)
        continue
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(path)
      const { data: row, error: insErr } = await supabase
        .from('professional_photos')
        .insert({ contractor_id: userId, storage_path: path, url: publicUrl, sort_order: next })
        .select('id, storage_path, url, caption, sort_order')
        .single()
      if (insErr || !row) {
        console.error('[photos] save failed', insErr)
        await supabase.storage.from(BUCKET).remove([path])
        toast.error(
          insErr?.hint === 'photo_limit'
            ? `You can add up to ${MAX_PHOTOS} photos.`
            : `Couldn't save ${file.name}. Please try again.`
        )
        continue
      }
      next += 1
      added.push(row as Photo)
    }
    if (added.length > 0) {
      setPhotos((prev) => [...prev, ...added])
      toast.success(added.length === 1 ? 'Photo added' : `${added.length} photos added`)
    }
    setBusy(false)
  }

  async function remove(photo: Photo) {
    if (isDemoMode()) return
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.from('professional_photos').delete().eq('id', photo.id)
    if (error) {
      toast.error("Couldn't remove that photo. Please try again.")
    } else {
      await supabase.storage.from(BUCKET).remove([photo.storage_path])
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
    }
    setBusy(false)
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= photos.length || isDemoMode()) return
    const reordered = [...photos]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    const withOrder = reordered.map((p, i) => ({ ...p, sort_order: i }))
    const previous = photos
    setPhotos(withOrder)
    setBusy(true)
    const supabase = createClient()
    const changed = withOrder.filter((p) => previous.find((q) => q.id === p.id)?.sort_order !== p.sort_order)
    const results = await Promise.all(
      changed.map((p) =>
        supabase.from('professional_photos').update({ sort_order: p.sort_order }).eq('id', p.id)
      )
    )
    if (results.some((r) => r.error)) {
      toast.error("Couldn't save the new order. Please try again.")
      setPhotos(previous)
    }
    setBusy(false)
  }

  async function saveCaption(photo: Photo, caption: string) {
    const value = caption.trim().slice(0, 200) || null
    if (value === photo.caption || isDemoMode()) return
    const supabase = createClient()
    const { error } = await supabase
      .from('professional_photos')
      .update({ caption: value })
      .eq('id', photo.id)
    if (error) {
      toast.error("Couldn't save that caption.")
      return
    }
    setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, caption: value } : p)))
  }

  if (state === 'loading') {
    return (
      <div className="flex items-center gap-2 text-sm text-[#62646a]">
        <Loader2 className="size-4 animate-spin" /> Loading photos…
      </div>
    )
  }
  if (state === 'unavailable') {
    return (
      <p className="rounded-xl border border-dashed border-[#e4e5e7] bg-[#fafafa] px-4 py-5 text-sm text-[#62646a]">
        Photo galleries are coming soon.
      </p>
    )
  }

  return (
    <div>
      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {photos.map((p, i) => (
            <li key={p.id} className="overflow-hidden rounded-xl border border-[#e4e5e7] bg-white">
              <div className="relative aspect-[4/3] bg-[#f1f1f2]">
                {/* eslint-disable-next-line @next/next/no-img-element -- Supabase storage host */}
                <img src={p.url} alt={p.caption ?? `Photo ${i + 1}`} className="size-full object-cover" />
                {i === 0 && (
                  <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
                    First
                  </span>
                )}
              </div>
              <div className="space-y-2 p-2.5">
                <input
                  defaultValue={p.caption ?? ''}
                  maxLength={200}
                  placeholder="Add a caption"
                  aria-label={`Caption for photo ${i + 1}`}
                  onBlur={(e) => void saveCaption(p, e.target.value)}
                  className="h-9 w-full rounded-md border border-[#e4e5e7] px-2.5 text-sm outline-none focus:border-[#1dbf73]"
                />
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <IconButton label="Move earlier" disabled={busy || i === 0} onClick={() => void move(i, -1)}>
                      <ArrowLeft className="size-4" />
                    </IconButton>
                    <IconButton
                      label="Move later"
                      disabled={busy || i === photos.length - 1}
                      onClick={() => void move(i, 1)}
                    >
                      <ArrowRight className="size-4" />
                    </IconButton>
                  </div>
                  <IconButton label="Remove photo" disabled={busy} onClick={() => void remove(p)} danger>
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy || photos.length >= MAX_PHOTOS}
        className={`flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#bcebd5] bg-[#f6fdf9] px-4 py-6 text-sm font-semibold text-[#0f8f56] transition hover:border-[#1dbf73] disabled:opacity-60 ${photos.length > 0 ? 'mt-4' : ''}`}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
        {photos.length >= MAX_PHOTOS ? `Limit of ${MAX_PHOTOS} photos reached` : 'Add photos'}
      </button>
      <p className="mt-1.5 text-xs text-[#62646a]">
        Your practice, workspace, or work. JPG, PNG, or WebP up to 8 MB, {MAX_PHOTOS} photos max.
        Don&apos;t include patients or anything that identifies them.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleFiles}
      />
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex size-8 items-center justify-center rounded-md border border-[#e4e5e7] transition disabled:opacity-40 ${
        danger ? 'text-[#b42318] hover:bg-[#fef3f2]' : 'text-[#404145] hover:bg-[#f1f1f2]'
      }`}
    >
      {children}
    </button>
  )
}
