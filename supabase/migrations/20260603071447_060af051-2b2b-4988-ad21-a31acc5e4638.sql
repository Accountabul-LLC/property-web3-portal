-- Promote the test vendor to verified so the public profile page renders for everyone
UPDATE public.vendor_profiles
SET verification_status = 'verified',
    verification_tier   = COALESCE(NULLIF(verification_tier,'unverified'), 'business_verified'),
    verified_at         = COALESCE(verified_at, now()),
    reviewed_at         = COALESCE(reviewed_at, now()),
    public_profile_enabled = true
WHERE slug = 'vendor-marketplace-approved';