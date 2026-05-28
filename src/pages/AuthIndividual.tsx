import { Seo } from '@/components/Seo';
import { AuthForm } from '@/components/auth/AuthForm';

const AuthIndividual = () => (
  <>
    <Seo
      title="Individual Sign Up | Accountabul"
      description="Create your personal Accountabul account to invest in tokenized real estate, track your portfolio, and access the marketplace."
      path="/auth/individual"
    />
    <AuthForm
      variant="individual"
      title="Individual Account"
      subtitle="Invest in tokenized real estate and track your portfolio"
      redirectAfterSignup="/dashboard"
    />
  </>
);

export default AuthIndividual;
