-- KYC Phase 1: Cases, Form Data, Documents, Status History
-- Adds compliance_officer role, creates KYC tables with RLS, and helper function
-- disable transaction: required so the new enum value is committed before use in policies

-- Add compliance_officer to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'compliance_officer';
COMMIT;

-- KYC cases table (one per user)
CREATE TABLE IF NOT EXISTS public.kyc_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','in_progress','submitted','under_review','approved','rejected','expired')),
  rejection_reason TEXT,
  reviewer_id UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- KYC form data (PII, NOT documents)
CREATE TABLE IF NOT EXISTS public.kyc_form_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_case_id UUID NOT NULL REFERENCES public.kyc_cases(id) ON DELETE CASCADE,
  legal_first_name TEXT,
  legal_last_name TEXT,
  date_of_birth DATE,
  nationality TEXT,
  country_of_residence TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  tax_id TEXT,
  source_of_funds TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(kyc_case_id)
);

-- KYC status history (immutable audit trail)
CREATE TABLE IF NOT EXISTS public.kyc_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_case_id UUID NOT NULL REFERENCES public.kyc_cases(id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id UUID REFERENCES auth.users(id),
  actor_role TEXT,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Document uploads (metadata only — files in Storage)
CREATE TABLE IF NOT EXISTS public.kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_case_id UUID NOT NULL REFERENCES public.kyc_cases(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL
    CHECK (doc_type IN ('government_id_front','government_id_back','selfie','proof_of_address','tax_document','other')),
  storage_path TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  file_size_bytes INTEGER,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected')),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kyc_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_form_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

-- Users can see/edit their own KYC case
CREATE POLICY "users_own_kyc_case" ON public.kyc_cases
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_kyc_form" ON public.kyc_form_data
  FOR ALL TO authenticated
  USING (
    kyc_case_id IN (SELECT id FROM public.kyc_cases WHERE user_id = auth.uid())
  )
  WITH CHECK (
    kyc_case_id IN (SELECT id FROM public.kyc_cases WHERE user_id = auth.uid())
  );

CREATE POLICY "users_own_kyc_docs" ON public.kyc_documents
  FOR ALL TO authenticated
  USING (
    kyc_case_id IN (SELECT id FROM public.kyc_cases WHERE user_id = auth.uid())
  )
  WITH CHECK (
    kyc_case_id IN (SELECT id FROM public.kyc_cases WHERE user_id = auth.uid())
  );

CREATE POLICY "users_read_own_history" ON public.kyc_status_history
  FOR SELECT TO authenticated
  USING (
    kyc_case_id IN (SELECT id FROM public.kyc_cases WHERE user_id = auth.uid())
  );

-- Admins / compliance officers can see all
CREATE POLICY "admins_all_kyc" ON public.kyc_cases
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'compliance_officer'));

CREATE POLICY "admins_all_kyc_form" ON public.kyc_form_data
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'compliance_officer'));

CREATE POLICY "admins_all_kyc_docs" ON public.kyc_documents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'compliance_officer'));

CREATE POLICY "admins_all_history" ON public.kyc_status_history
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'compliance_officer'));

-- Helper: returns KYC status for a user (used in edge function guards)
CREATE OR REPLACE FUNCTION public.get_kyc_status(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT status FROM public.kyc_cases WHERE user_id = p_user_id),
    'not_started'
  );
$$;
