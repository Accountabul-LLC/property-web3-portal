import { Seo } from '@/components/Seo';
import { AuthForm } from '@/components/auth/AuthForm';
import { supabase } from '@/integrations/supabase/client';

async function resolveVendorRedirect(userId: string): Promise<string> {
  try {
    const { data } = await (supabase as any)
      .from('vendor_profiles')
      .select('verification_status')
      .eq('user_id', userId)
      .maybeSingle();

    const status = data?.verification_status as
      | 'not_requested'
      | 'requested'
      | 'under_review'
      | 'verified'
      | 'rejected'
      | 'revoked'
      | undefined;

    switch (status) {
      case 'verified':
        return '/vendor/dashboard';
      case 'requested':
      case 'under_review':
        return '/vendor/status';
      case 'rejected':
      case 'revoked':
        return '/vendor/status';
      default:
        return '/vendor/onboarding';
    }
  } catch (err) {
    console.warn('vendor status lookup failed; defaulting to onboarding', err);
    return '/vendor/onboarding';
  }
}

const AuthVendor = () => (
  <>
    <Seo
      title="Vendor Sign Up | Accountabul"
      description="Join the Accountabul verified vendor network. Sign up as a business to verify your identity, pay your membership, and earn the verified vendor badge."
      path="/auth/vendor"
    />
    <AuthForm
      variant="vendor"
      title="Vendor Account"
      subtitle="Join the verified vendor network and earn the trust badge"
      redirectAfterSignup="/vendor/onboarding"
      redirectAfterLogin="/vendor/onboarding"
      resolveLoginRedirect={resolveVendorRedirect}
    />
  </>
);

export default AuthVendor;
