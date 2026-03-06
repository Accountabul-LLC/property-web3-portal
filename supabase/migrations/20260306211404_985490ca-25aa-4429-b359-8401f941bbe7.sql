
-- Create kyc_status_history table for audit trail
CREATE TABLE IF NOT EXISTS public.kyc_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_case_id UUID NOT NULL REFERENCES public.kyc_cases(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id UUID REFERENCES auth.users(id),
  actor_role TEXT,
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kyc_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read kyc status history"
  ON public.kyc_status_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service can insert kyc status history"
  ON public.kyc_status_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add missing columns to kyc_cases that edge functions reference
ALTER TABLE public.kyc_cases ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
