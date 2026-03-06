
-- 1. Add compliance_officer to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'compliance_officer';

-- 2. Create kyc_cases table
CREATE TABLE IF NOT EXISTS public.kyc_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started',
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewer_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.kyc_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own kyc case"
  ON public.kyc_cases FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own kyc case"
  ON public.kyc_cases FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own kyc case"
  ON public.kyc_cases FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all kyc cases"
  ON public.kyc_cases FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all kyc cases"
  ON public.kyc_cases FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Create kyc_form_data table
CREATE TABLE IF NOT EXISTS public.kyc_form_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_case_id UUID NOT NULL REFERENCES public.kyc_cases(id) ON DELETE CASCADE,
  legal_first_name TEXT,
  legal_last_name TEXT,
  date_of_birth TEXT,
  nationality TEXT,
  country_of_residence TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  source_of_funds TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(kyc_case_id)
);

ALTER TABLE public.kyc_form_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own kyc form data"
  ON public.kyc_form_data FOR ALL
  TO authenticated
  USING (
    kyc_case_id IN (SELECT id FROM public.kyc_cases WHERE user_id = auth.uid())
  )
  WITH CHECK (
    kyc_case_id IN (SELECT id FROM public.kyc_cases WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can read all kyc form data"
  ON public.kyc_form_data FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Create kyc_documents table
CREATE TABLE IF NOT EXISTS public.kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_case_id UUID NOT NULL REFERENCES public.kyc_cases(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  file_size_bytes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(kyc_case_id, doc_type)
);

ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own kyc documents"
  ON public.kyc_documents FOR ALL
  TO authenticated
  USING (
    kyc_case_id IN (SELECT id FROM public.kyc_cases WHERE user_id = auth.uid())
  )
  WITH CHECK (
    kyc_case_id IN (SELECT id FROM public.kyc_cases WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can read all kyc documents"
  ON public.kyc_documents FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Create ai_debate_sessions table
CREATE TABLE IF NOT EXISTS public.ai_debate_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'debate',
  rounds INTEGER NOT NULL DEFAULT 3,
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_debate_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own debate sessions"
  ON public.ai_debate_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own debate sessions"
  ON public.ai_debate_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 6. Create kyc-documents storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own kyc docs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = 'kyc'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "Users can read own kyc docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = 'kyc'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "Admins can read all kyc docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND public.has_role(auth.uid(), 'admin')
  );
