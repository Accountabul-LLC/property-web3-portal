CREATE POLICY "Users read own kyc status history"
  ON public.kyc_status_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kyc_cases kc
      WHERE kc.id = kyc_status_history.kyc_case_id
        AND kc.user_id = auth.uid()
    )
  );