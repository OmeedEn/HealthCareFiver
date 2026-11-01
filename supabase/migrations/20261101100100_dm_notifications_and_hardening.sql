-- 20261101100100_dm_notifications_and_hardening.sql
-- Client <-> professional messaging:
--   1. In-app notification for new direct messages (no message content: PHI).
--   2. Conversation partners can see each other's names (names only).
--   3. Participants may only update read state on messages.

-- ---------------------------------------------------------------------------
-- 1. New-message notifications
-- Skips support threads (src/app/admin/messages/actions.ts notifies those)
-- and system messages. At most one unread 'new_message' notification per
-- recipient + conversation. Never blocks the message insert.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p1 UUID;
  v_p2 UUID;
  v_support BOOLEAN;
  v_recipient UUID;
  v_name TEXT;
BEGIN
  IF NEW.is_system_message THEN
    RETURN NEW;
  END IF;

  SELECT participant_1, participant_2, is_support
    INTO v_p1, v_p2, v_support
  FROM conversations
  WHERE id = NEW.conversation_id;

  IF NOT FOUND OR v_support THEN
    RETURN NEW;
  END IF;

  v_recipient := CASE WHEN NEW.sender_id = v_p1 THEN v_p2 ELSE v_p1 END;
  IF v_recipient IS NULL OR v_recipient = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.user_id = v_recipient
      AND n.type = 'new_message'
      AND NOT n.is_read
      AND n.data->>'conversation_id' = NEW.conversation_id::text
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(
      NULLIF(btrim(concat_ws(' ', cp.first_name, cp.last_name)), ''),
      NULLIF(btrim(concat_ws(' ', cl.first_name, cl.last_name)), ''),
      NULLIF(btrim(f.facility_name), '')
    )
    INTO v_name
  FROM (SELECT NEW.sender_id AS id) s
  LEFT JOIN contractor_profiles cp ON cp.id = s.id
  LEFT JOIN client_profiles cl ON cl.id = s.id
  LEFT JOIN facility_profiles f ON f.id = s.id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_recipient,
    'new_message',
    'New message from ' || COALESCE(v_name, 'a Sanus member'),
    'Open the conversation to read it.',
    jsonb_build_object(
      'href', '/messages/' || NEW.conversation_id::text,
      'conversation_id', NEW.conversation_id
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_new_message failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_new_message() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS messages_notify_recipient ON public.messages;
CREATE TRIGGER messages_notify_recipient
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

-- Fast throttle lookup.
CREATE INDEX IF NOT EXISTS idx_notifications_unread_new_message
  ON public.notifications (user_id, ((data->>'conversation_id')))
  WHERE type = 'new_message' AND NOT is_read;

-- ---------------------------------------------------------------------------
-- 2. Conversation partner names
-- client_profiles is owner/admin only and contractor_profiles hides pros who
-- aren't live, so the inbox showed "Unknown". A row-level policy would expose
-- every column (goals, notes, zip, license data), so this returns names only,
-- and only for people the caller shares a non-support conversation with.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.conversation_partner_names()
RETURNS TABLE (id UUID, first_name TEXT, last_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH partners AS (
    SELECT DISTINCT
      CASE WHEN c.participant_1 = auth.uid() THEN c.participant_2 ELSE c.participant_1 END AS pid
    FROM conversations c
    WHERE auth.uid() IS NOT NULL
      AND NOT c.is_support
      AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
  )
  SELECT
    p.pid,
    CASE WHEN cp.id IS NOT NULL THEN cp.first_name ELSE cl.first_name END,
    CASE WHEN cp.id IS NOT NULL THEN cp.last_name ELSE cl.last_name END
  FROM partners p
  LEFT JOIN contractor_profiles cp ON cp.id = p.pid
  LEFT JOIN client_profiles cl ON cl.id = p.pid
  WHERE cp.id IS NOT NULL OR cl.id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.conversation_partner_names() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conversation_partner_names() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Messages: participants may only flip read state (messages_update_read
-- otherwise lets them rewrite content / sender_id).
-- ---------------------------------------------------------------------------
REVOKE UPDATE ON public.messages FROM anon, authenticated;
GRANT UPDATE (is_read, read_at) ON public.messages TO authenticated;
