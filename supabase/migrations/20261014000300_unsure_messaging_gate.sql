-- Signup Routing Update: "Not sure" accounts can't message professionals.
--
-- A Not sure signup is a client-role account with signup_path 'UNSURE'.
-- While classification_status is 'pending' (awaiting staff placement) or
-- 'rejected', it has the same limits as an account under review: browse,
-- save and book as a client, but no messaging professionals. Staff (admin)
-- threads stay open so the team can ask for more details.
--
-- Messaging is written straight from the browser (src/app/(dashboard)/messages),
-- so the gate lives in RLS. Recreates the conversations/messages insert
-- policies from 20261001000500_org_verification.sql with one extra condition.

-- True when the caller is a restricted Not sure account and the other
-- participant is not an admin. SECURITY DEFINER so it reads profiles
-- regardless of the caller's policies; only ever looks at auth.uid() and
-- the given participant's role.
CREATE OR REPLACE FUNCTION public.classification_blocks_messaging(p_other UUID)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM profiles me
    WHERE me.id = auth.uid()
      AND me.signup_path = 'UNSURE'
      AND me.classification_status IN ('pending', 'rejected')
  )
  AND NOT EXISTS (
    SELECT 1 FROM profiles o WHERE o.id = p_other AND o.role = 'admin'
  );
$function$;

REVOKE ALL ON FUNCTION public.classification_blocks_messaging(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.classification_blocks_messaging(UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS "conversations_insert_participant" ON conversations;
CREATE POLICY "conversations_insert_participant"
  ON conversations FOR INSERT
  WITH CHECK (
    (participant_1 = auth.uid() OR participant_2 = auth.uid())
    AND NOT caller_org_not_approved()
    AND NOT classification_blocks_messaging(
      CASE WHEN participant_1 = auth.uid() THEN participant_2 ELSE participant_1 END
    )
  );

DROP POLICY IF EXISTS "messages_insert_sender" ON messages;
CREATE POLICY "messages_insert_sender"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND NOT caller_org_not_approved()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
        AND NOT classification_blocks_messaging(
          CASE WHEN c.participant_1 = auth.uid() THEN c.participant_2 ELSE c.participant_1 END
        )
    )
  );
