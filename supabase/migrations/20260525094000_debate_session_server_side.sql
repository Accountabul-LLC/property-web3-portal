-- Move debate transcript persistence behind a server-side function.

REVOKE INSERT, UPDATE, DELETE ON public.ai_debate_sessions FROM authenticated, anon;

DROP POLICY IF EXISTS "Users can insert own debate sessions" ON public.ai_debate_sessions;
