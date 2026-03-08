CREATE OR REPLACE FUNCTION public.get_kyc_status(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    (SELECT status FROM public.kyc_cases WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 1),
    'not_started'
  )
$$;