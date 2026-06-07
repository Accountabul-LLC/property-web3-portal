import { Seo } from '@/components/Seo';
import { AuthForm } from '@/components/auth/AuthForm';

const AuthBusiness = () => (
  <>
    <Seo
      title="Business Sign Up | Accountabul"
      description="Open a business account on Accountabul to tokenize properties, manage entities, and optionally join the verified vendor network."
      path="/auth/business"
    />
    <AuthForm
      variant="business"
      title="Business Account"
      subtitle="Tokenize properties, manage your entity, and optionally join the verified vendor network."
      redirectAfterSignup="/dashboard"
      showVendorOptIn
      vendorRedirect="/vendors/apply"
    />
  </>
);

export default AuthBusiness;
