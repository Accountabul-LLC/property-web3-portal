import { Seo } from '@/components/Seo';
import { AuthForm } from '@/components/auth/AuthForm';

const AuthBusiness = () => (
  <>
    <Seo
      title="Business Sign Up | Accountabul"
      description="Open a business account on Accountabul to tokenize properties, manage entities, and unlock vendor network access."
      path="/auth/business"
    />
    <AuthForm
      variant="business"
      title="Business Account"
      subtitle="Tokenize properties and manage your entity on Accountabul"
      redirectAfterSignup="/dashboard"
    />
  </>
);

export default AuthBusiness;
