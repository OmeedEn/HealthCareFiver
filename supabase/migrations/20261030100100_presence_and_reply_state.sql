-- 20261030100100_presence_and_reply_state.sql
-- Admin inbox signals:
--   1. "Online" dot: signed-in browsers call touch_presence() about once a
--      minute while the tab is visible; online = seen in the last ~2 minutes.
--      Only admin code (service role) reads user_presence.
--   2. "Needs reply" / "Waiting on them": conversations remember who sent
--      the latest message.

-- ---------------------------------------------------------------------------
-- Presence
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_presence FROM anon, authenticated;

-- Writes only the caller's own row. Skips the write if it was touched in the
-- last 20 seconds, so extra tabs don't multiply writes.
CREATE OR REPLACE FUNCTION public.touch_presence()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO user_presence (user_id, last_seen_at)
  SELECT auth.uid(), NOW()
  WHERE auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
  ON CONFLICT (user_id) DO UPDATE
    SET last_seen_at = EXCLUDED.last_seen_at
    WHERE user_presence.last_seen_at < NOW() - INTERVAL '20 seconds';
$$;

REVOKE ALL ON FUNCTION public.touch_presence() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_presence() TO authenticated;

-- ---------------------------------------------------------------------------
-- Who sent the latest message
-- ---------------------------------------------------------------------------
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS last_message_sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

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
    last_message_sender_id = NEW.sender_id,
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

-- Backfill from existing messages.
UPDATE conversations c
SET last_message_sender_id = m.sender_id
FROM (
  SELECT DISTINCT ON (conversation_id) conversation_id, sender_id
  FROM messages
  ORDER BY conversation_id, created_at DESC
) m
WHERE m.conversation_id = c.id
  AND c.last_message_sender_id IS NULL;
