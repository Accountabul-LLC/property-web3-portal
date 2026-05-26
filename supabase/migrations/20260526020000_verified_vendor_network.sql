-- Reframe the business-only vendor credential as a verified vendor network entry.

UPDATE public.credential_catalog
SET
  credential_name = 'Verified Vendor',
  description = 'Business profile approved to operate in the verified vendor network.',
  user_benefit = 'Display a verified vendor badge on your business profile and marketplace cards.',
  user_cta = 'Request Verified Vendor Status'
WHERE credential_key = 'vendor';

UPDATE public.route_access_rules
SET route_label = 'Verified Vendor Dashboard'
WHERE route_key = 'vendor_dashboard';
