-- Ensure RLS is enabled on realtime.messages
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop any prior policy we created to keep this idempotent
DROP POLICY IF EXISTS "Users can only access own notification channel" ON realtime.messages;

-- Allow authenticated users to read/write only on channels scoped to their own user id.
-- Our app uses topic name: `user-notifications-<user_id>`
CREATE POLICY "Users can only access own notification channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = 'user-notifications-' || auth.uid()::text
);
