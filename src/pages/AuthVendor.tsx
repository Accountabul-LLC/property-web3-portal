import { Seo } from '@/components/Seo';
import { AuthForm } from '@/components/auth/AuthForm';

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
      redirectAfterSignup="/vendors/apply"
      redirectAfterLogin="/vendors/apply"
    />
  </>
);

export default AuthVendor;
