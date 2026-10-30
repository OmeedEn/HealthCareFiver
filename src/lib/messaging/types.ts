import type { AttachmentType } from './attachments'

export interface MessageItem {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  read_at: string | null
  attachment_path?: string | null
  attachment_type?: AttachmentType | null
  attachment_name?: string | null
  attachment_size?: number | null
}

/** Columns MessageItem needs, for .select() calls. */
export const MESSAGE_SELECT =
  'id, conversation_id, sender_id, content, created_at, read_at, attachment_path, attachment_type, attachment_name, attachment_size'
