/**
 * Message attachments live in the PRIVATE `message-attachments` bucket at
 * `{conversation_id}/{sender_id}/{file}` (see
 * supabase/migrations/20261029100100_support_messaging.sql). They're shown
 * through short-lived signed URLs. Safe to import from client components.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const MESSAGE_ATTACHMENTS_BUCKET = 'message-attachments'
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024
export const ATTACHMENT_ACCEPT = 'image/*,video/*,audio/*,application/pdf'

export type AttachmentType = 'image' | 'audio' | 'video' | 'file'

export interface MessageAttachment {
  path: string
  type: AttachmentType
  mime: string
  name: string
  size: number
}

/** "audio/webm;codecs=opus" -> "audio/webm" (bucket MIME rules ignore params). */
export function baseMime(mime: string): string {
  return (mime.split(';')[0] || 'application/octet-stream').trim().toLowerCase()
}

export function attachmentTypeFor(mime: string): AttachmentType | null {
  const m = baseMime(mime)
  if (m.startsWith('image/')) return 'image'
  if (m.startsWith('audio/')) return 'audio'
  if (m.startsWith('video/')) return 'video'
  if (m === 'application/pdf') return 'file'
  return null
}

const EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'video/webm': 'webm',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
}

function extensionFor(file: File): string {
  const fromName = file.name.includes('.') ? file.name.split('.').pop() : null
  return (fromName || EXT[baseMime(file.type)] || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Returns an error message, or null when the file can be sent. */
export function validateAttachment(file: File): string | null {
  if (!attachmentTypeFor(file.type)) {
    return 'Only photos, videos, audio and PDFs can be attached.'
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return 'Files must be 50 MB or smaller.'
  }
  return null
}

/** Upload with the signed-in user's browser client. */
export async function uploadAttachment(
  supabase: SupabaseClient,
  conversationId: string,
  senderId: string,
  file: File
): Promise<MessageAttachment> {
  const problem = validateAttachment(file)
  if (problem) throw new Error(problem)
  const mime = baseMime(file.type)
  const path = `${conversationId}/${senderId}/${crypto.randomUUID()}.${extensionFor(file)}`
  const { error } = await supabase.storage
    .from(MESSAGE_ATTACHMENTS_BUCKET)
    .upload(path, file, { contentType: mime, upsert: false })
  if (error) throw error
  return {
    path,
    type: attachmentTypeFor(mime)!,
    mime,
    name: file.name || `attachment.${extensionFor(file)}`,
    size: file.size,
  }
}

/** Column values for a messages insert. */
export function attachmentColumns(a: MessageAttachment | null | undefined) {
  if (!a) return {}
  return {
    attachment_path: a.path,
    attachment_type: a.type,
    attachment_mime: a.mime,
    attachment_name: a.name.slice(0, 200),
    attachment_size: a.size,
  }
}
