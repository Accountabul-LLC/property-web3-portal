
-- property_documents: require ownership of related property or admin
DROP POLICY IF EXISTS "Authenticated can insert property documents" ON public.property_documents;
CREATE POLICY "Owners or admins can insert property documents"
ON public.property_documents
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_documents.property_id
      AND p.owner_user_id = auth.uid()
  )
);

-- kyc_status_history: restrict client inserts to admins (service role bypasses RLS)
DROP POLICY IF EXISTS "Service can insert kyc status history" ON public.kyc_status_history;
CREATE POLICY "Admins can insert kyc status history"
ON public.kyc_status_history
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Add explicit admin SELECT policies to internal tables (default-deny remains for others)
CREATE POLICY "Admins can read wallet profiles"
ON public.wallet_profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can read xaman payloads"
ON public.xaman_payloads
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
