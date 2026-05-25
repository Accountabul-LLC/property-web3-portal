
-- 1) Campaigns: restrict public read, expose safe columns via view
DROP POLICY IF EXISTS "public_read_active_campaigns" ON public.campaigns;

CREATE OR REPLACE VIEW public.campaigns_public
WITH (security_invoker = false) AS
SELECT
  id, title, slug, description, image_url, gallery_urls, video_url,
  network, campaign_mode, default_release_offset_days,
  goal_amount, currency, accepted_assets,
  recipient_wallet_address, release_date, status,
  total_raised, donor_count, created_at, updated_at, visibility
FROM public.campaigns
WHERE status IN ('active','completed') AND visibility = 'public';

GRANT SELECT ON public.campaigns_public TO anon, authenticated;

-- Submitter can read their own campaign rows
CREATE POLICY "submitters_read_own_campaigns"
ON public.campaigns
FOR SELECT
TO authenticated
USING (submitted_by_user_id = auth.uid());

-- Donors who contributed can read the campaign row they donated to
CREATE POLICY "donors_read_donated_campaigns"
ON public.campaigns
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.campaign_donations d
    WHERE d.campaign_id = campaigns.id
      AND (d.donor_user_id = auth.uid() OR public.owns_wallet(d.donor_wallet_address))
  )
);

-- 2) Professionals: restrict INSERT to admins
DROP POLICY IF EXISTS "Authenticated can insert professionals" ON public.professionals;
CREATE POLICY "Admins can insert professionals"
ON public.professionals
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Property reviews: enforce wallet ownership
DROP POLICY IF EXISTS "Authenticated can insert property reviews" ON public.property_reviews;
CREATE POLICY "Owners can insert property reviews"
ON public.property_reviews
FOR INSERT
TO authenticated
WITH CHECK (public.owns_wallet(wallet_address));
