-- 20261029100100_support_messaging.sql
-- Admin <-> user support threads with photo, voice and video attachments.
--
-- A support thread is a conversation with is_support = true whose two
-- participant columns both hold the user (participant_1 = participant_2 =
-- user id). That keeps the existing UNIQUE (participant_1, participant_2)
-- meaning "one support thread per user", never collides with a normal DM,
-- and lets the user's existing participant-based policies work unchanged.
-- Any admin can read the thread (existing is_admin() select policies); admins
-- post through a server action using the service role, so no admin INSERT
-- policy on messages is needed.
--
-- Support threads ignore the org-approval and "Not sure" messaging gates:
-- the whole point is letting staff ask unapproved accounts for documents.
--
-- Attachments live in the PRIVATE `message-attachments` bucket at
-- `{conversation_id}/{sender_id}/{file}` and are viewed via short-lived
-- signed URLs. One attachment per message.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS is_support BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_conversations_support
  ON conversations (last_message_at DESC) WHERE is_support;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS attachment_type TEXT,
  ADD COLUMN IF NOT EXISTS attachment_mime TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_size INTEGER;

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_attachment_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_attachment_type_check
  CHECK (attachment_type IS NULL OR attachment_type IN ('image', 'audio', 'video', 'file'));

-- A message needs text or an attachment.
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_content_or_attachment;
ALTER TABLE messages ADD CONSTRAINT messages_content_or_attachment
  CHECK (btrim(content) <> '' OR attachment_path IS NOT NULL) NOT VALID;

-- ---------------------------------------------------------------------------
-- Conversation preview: label attachment-only messages.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = CASE
      WHEN btrim(NEW.content) <> '' THEN LEFT(NEW.content, 100)
      WHEN NEW.attachment_type = 'image' THEN 'Photo'
      WHEN NEW.attachment_type = 'audio' THEN 'Voice message'
      WHEN NEW.attachment_type = 'video' THEN 'Video'
      ELSE 'Attachment'
    END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Access helper (used by storage policies). SECURITY DEFINER so it can read
-- conversations regardless of the caller's policies; only answers for
-- auth.uid().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_conversation(p_conversation UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = p_conversation
      AND (
        c.participant_1 = auth.uid()
        OR c.participant_2 = auth.uid()
        OR (c.is_support AND public.is_admin())
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_conversation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_conversation(UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Message insert: support threads bypass the org / Not sure gates, and an
-- attachment must live under the message's own conversation folder.
-- Recreates the policy from 20261014000300_unsure_messaging_gate.sql.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "messages_insert_sender" ON messages;
CREATE POLICY "messages_insert_sender"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      attachment_path IS NULL
      OR split_part(attachment_path, '/', 1) = messages.conversation_id::text
    )
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
        AND (
          c.is_support
          OR (
            NOT caller_org_not_approved()
            AND NOT classification_blocks_messaging(
              CASE WHEN c.participant_1 = auth.uid() THEN c.participant_2 ELSE c.participant_1 END
            )
          )
        )
    )
  );

-- Users may open their own support thread (participant_1 = participant_2 =
-- self). Normal DMs keep the existing gates.
DROP POLICY IF EXISTS "conversations_insert_participant" ON conversations;
CREATE POLICY "conversations_insert_participant"
  ON conversations FOR INSERT
  WITH CHECK (
    (
      is_support
      AND participant_1 = auth.uid()
      AND participant_2 = auth.uid()
    )
    OR (
      NOT is_support
      AND (participant_1 = auth.uid() OR participant_2 = auth.uid())
      AND NOT caller_org_not_approved()
      AND NOT classification_blocks_messaging(
        CASE WHEN participant_1 = auth.uid() THEN participant_2 ELSE participant_1 END
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Storage bucket (private, 50 MB per file).
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  false,
  52428800,
  ARRAY['image/*', 'audio/*', 'video/*', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "message_attachments_insert" ON storage.objects;
CREATE POLICY "message_attachments_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'message-attachments'
    AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
    AND public.can_access_conversation(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "message_attachments_select" ON storage.objects;
CREATE POLICY "message_attachments_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'message-attachments'
    AND public.can_access_conversation(((storage.foldername(name))[1])::uuid)
  );

-- ---------------------------------------------------------------------------
-- Realtime: live message delivery needs both tables in the publication.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
END $$;
