-- Restore public-safe column SELECT grants on campaigns.
-- Sensitive columns (admin_notes, rejection_reason, submitted_by_email,
-- submission_notes, submitted_by_user_id, approved_by, approved_at,
-- hidden_by, hidden_reason, hidden_at) remain ungranted to anon/authenticated;
-- admins still read full rows via admin_list_campaigns().

GRANT SELECT (
  id, title, slug, description, image_url, gallery_urls, video_url,
  network, campaign_mode, default_release_offset_days,
  goal_amount, currency, accepted_assets, recipient_wallet_address,
  release_date, status, visibility, total_raised, donor_count,
  created_at, updated_at
) ON public.campaigns TO anon, authenticated;
