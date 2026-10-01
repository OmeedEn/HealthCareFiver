'use client'

import { useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode } from '@/lib/demo/data'

const AVATAR_BUCKET = 'avatars'
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/**
 * Headshot upload. Stores the image in the public `avatars` bucket at
 * `{user_id}/headshot-{timestamp}.{ext}` (owner-write policy keyed on the
 * first path segment) and saves the public URL to profiles.avatar_url right
 * away, so it persists even if the rest of the form isn't saved.
 */
export function HeadshotUpload({
  avatarUrl,
  initials,
  onUploaded,
}: {
  avatarUrl: string | null
  initials: string
  onUploaded: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const ext = ALLOWED_TYPES[file.type]
    if (!ext) {
      toast.error('Please upload a JPG, PNG, or WebP image.')
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error('Headshot must be 5 MB or smaller.')
      return
    }
    if (isDemoMode()) {
      toast.success('Headshot updated (demo)')
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')

      // Unique name per upload so CDN / browser caches never serve the old photo.
      const path = `${user.id}/headshot-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false })
      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)
      if (profileError) throw profileError

      // Keep auth metadata in sync — the marketing nav reads it.
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } })

      onUploaded(publicUrl)
      toast.success('Headshot updated')
    } catch (err) {
      console.error('[headshot] upload failed', err)
      toast.error('Failed to upload headshot. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar size="lg" className="size-20">
        {avatarUrl && <AvatarImage src={avatarUrl} alt="Your headshot" />}
        <AvatarFallback className="bg-[#e8faf1] text-xl font-semibold text-[#0f8f56]">
          {initials || '?'}
        </AvatarFallback>
      </Avatar>
      <div className="space-y-1.5">
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
          ) : (
            <Camera className="size-4" data-icon="inline-start" />
          )}
          {avatarUrl ? 'Change headshot' : 'Upload headshot'}
        </Button>
        <p className="text-xs text-[#62646a]">
          A clear, friendly photo of your face. JPG, PNG, or WebP, up to 5 MB.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFile}
        />
      </div>
    </div>
  )
}
