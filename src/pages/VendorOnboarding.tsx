import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Seo } from '@/components/Seo';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, Loader2, ShieldCheck, Building2, CreditCard, Award, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useVendorProfile } from '@/hooks/useVendorProfile';
import { useKycStatus } from '@/hooks/useKycStatus';
import { useMyMembership, useMembershipTiers, useSelectMembership } from '@/hooks/useMembershipTiers';
import { VendorProfileForm } from '@/components/vendor/VendorProfileForm';
import { cn } from '@/lib/utils';

type StepStatus = 'todo' | 'in_progress' | 'done';

interface OnboardingStep {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: StepStatus;
  cta?: { label: string; onClick: () => void };
  body?: React.ReactNode;
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'done') return <CheckCircle2 className="w-6 h-6 text-success" />;
  if (status === 'in_progress') return <Loader2 className="w-6 h-6 text-primary animate-spin" />;
  return <Circle className="w-6 h-6 text-muted-foreground" />;
}

function StatusBadge({ status }: { status: StepStatus }) {
  const label = status === 'done' ? 'Complete' : status === 'in_progress' ? 'In progress' : 'To do';
  return (
    <Badge
      variant="outline"
      className={cn(
        'hidden w-24 justify-center whitespace-nowrap sm:inline-flex',
        status === 'done' && 'border-success/40 text-success',
        status === 'in_progress' && 'border-primary/40 text-primary',
      )}
    >
      {label}
    </Badge>
  );
}

const VendorOnboarding = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, updateProfile } = useProfile();
  const [upgrading, setUpgrading] = useState(false);
  const { vendorProfile, isLoading: vendorLoading } = useVendorProfile(profile?.id);
  const { status: kycStatus, rejectionReason, isLoading: kycLoading } = useKycStatus();
  const { data: myTier, isLoading: membershipLoading } = useMyMembership();
  const { data: tiers, isLoading: tiersLoading } = useMembershipTiers();
  const selectMembership = useSelectMembership();

  const isBusiness = profile?.account_type === 'business';
  const loading = authLoading || profileLoading || (isBusiness && (vendorLoading || kycLoading || membershipLoading || tiersLoading));

  async function handleBusinessUpgrade() {
    setUpgrading(true);
    const { error } = await updateProfile({ account_type: 'business' });
    setUpgrading(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success('Business account enabled. Continue your vendor setup.');
  }

  // 1. Business profile completeness
  const profileStatus: StepStatus = useMemo(() => {
    if (!vendorProfile) return 'todo';
    const hasRequired =
      !!vendorProfile.company_name &&
      !!vendorProfile.business_email &&
      !!vendorProfile.business_phone &&
      !!vendorProfile.place_of_business;
    return hasRequired ? 'done' : 'in_progress';
  }, [vendorProfile]);

  // 2. KYC status
  const kycStepStatus: StepStatus =
    kycStatus === 'approved'
      ? 'done'
      : kycStatus === 'submitted' || kycStatus === 'under_review' || kycStatus === 'in_progress'
      ? 'in_progress'
      : 'todo';

  // 3. Membership status — prefer a dedicated vendor tier, then use the Professional plan as the current vendor-network path.
  const vendorTier = useMemo(
    () => tiers?.find((t) => t.slug === 'vendor') ?? tiers?.find((t) => t.slug === 'professional') ?? null,
    [tiers],
  );
  const paymentStatus: StepStatus = vendorTier && myTier?.id === vendorTier.id ? 'done' : 'todo';

  const completedCount = [profileStatus, kycStepStatus, paymentStatus].filter((s) => s === 'done').length;
  const progress = (completedCount / 3) * 100;
  const allDone = completedCount === 3;
  const isVerified = vendorProfile?.verification_status === 'verified';

  // Accordion: track which step is expanded
  type StepKey = 'profile' | 'kyc' | 'payment';
  const stepStatuses: Record<StepKey, StepStatus> = {
    profile: profileStatus,
    kyc: kycStepStatus,
    payment: paymentStatus,
  };
  const firstIncomplete = (): StepKey | null => {
    const order: StepKey[] = ['profile', 'kyc', 'payment'];
    return order.find((k) => stepStatuses[k] !== 'done') ?? null;
  };
  const [expandedStep, setExpandedStep] = useState<StepKey | null>(null);
  const [initialized, setInitialized] = useState(false);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Initialize expanded step once data is loaded
  useEffect(() => {
    if (!loading && !initialized) {
      setExpandedStep(firstIncomplete());
      setInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, initialized]);

  function toggleStep(key: StepKey) {
    setExpandedStep((prev) => (prev === key ? null : key));
  }

  function advanceAfterProfileSave() {
    const order: StepKey[] = ['kyc', 'payment'];
    const next = order.find((k) => stepStatuses[k] !== 'done') ?? null;
    setExpandedStep(next);
    if (next) {
      setTimeout(() => {
        cardRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }

  async function handleSelectVendorPlan() {
    if (!vendorTier) {
      toast.error('Vendor membership is not available yet.');
      return;
    }

    try {
      await selectMembership.mutateAsync(vendorTier.id);
      toast.success(`${vendorTier.name} membership activated.`);
      setExpandedStep(kycStepStatus !== 'done' ? 'kyc' : null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to activate vendor membership');
    }
  }

  // Redirect unauthenticated users to vendor signup
  if (!authLoading && !user) {
    return <Navigate to="/auth/vendor" replace />;
  }

  const steps: OnboardingStep[] = [
    {
      key: 'profile',
      title: 'Business Profile',
      description: 'Tell us about your company. We use this for your vendor badge and CRM record.',
      icon: Building2,
      status: profileStatus,
      body: <VendorProfileForm profileId={profile?.id} companyName={profile?.company_name} onSaved={advanceAfterProfileSave} />,
    },
    {
      key: 'kyc',
      title: 'Identity Verification',
      description:
        kycStatus === 'rejected'
          ? 'Your previous KYC submission was rejected. Please resubmit to continue.'
          : 'Verify the principal owner with our identity check. Required for vendor approval.',
      icon: ShieldCheck,
      status: kycStepStatus,
      body: (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium">Current status: {kycStatus.replace(/_/g, ' ')}</p>
            {rejectionReason && <p className="mt-1 text-sm text-muted-foreground">{rejectionReason}</p>}
            <p className="mt-1 text-sm text-muted-foreground">
              Complete identity verification when you're ready. You can return here and continue to vendor membership at any time.
            </p>
          </div>
          {kycStepStatus !== 'done' && (
            <div className="flex justify-end">
              <Button
                onClick={() => navigate(kycStatus === 'submitted' || kycStatus === 'under_review' ? '/kyc/status' : '/kyc')}
                variant={kycStepStatus === 'in_progress' ? 'default' : 'outline'}
              >
                {kycStatus === 'submitted' || kycStatus === 'under_review' ? 'View KYC Status' : 'Start Identity Verification'}
              </Button>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'payment',
      title: 'Vendor Membership',
      description: vendorTier
        ? `Activate the ${vendorTier.name} plan to join the verified vendor network.`
        : 'The vendor membership tier is being finalized. Check back soon or contact support.',
      icon: CreditCard,
      status: paymentStatus,
      body: (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium">{vendorTier ? vendorTier.name : 'Vendor membership'}</p>
              {vendorTier && <span className="text-sm text-muted-foreground">${Number(vendorTier.price_monthly).toFixed(0)}/month</span>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {paymentStatus === 'done'
                ? 'Your vendor membership is active for this onboarding flow.'
                : 'Activate the vendor membership manually here, or review all available plans first.'}
            </p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => navigate('/pricing')}>Review Plans</Button>
            {paymentStatus !== 'done' && vendorTier && (
              <Button onClick={handleSelectVendorPlan} disabled={selectMembership.isPending}>
                {selectMembership.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Activate Vendor Membership
              </Button>
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Seo
        title="Vendor Onboarding | Accountabul"
        description="Complete your business profile, verify your identity, and activate your vendor membership to earn the verified badge on Accountabul."
        path="/vendor/onboarding"
      />
      <Navigation />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <Badge variant="secondary" className="mb-3">Verified Vendor Network</Badge>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3 bg-gradient-primary bg-clip-text text-transparent">
            Become a Verified Vendor
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Three quick steps to unlock the verified badge across the marketplace and start receiving qualified leads.
          </p>
        </div>

        {/* Progress bar */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="font-medium">Onboarding progress</span>
              <span className="text-muted-foreground">{completedCount} of 3 complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>

        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : profile && !isBusiness ? (
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <Building2 className="w-12 h-12 text-primary mx-auto" />
              <h2 className="text-xl font-semibold">Upgrade to a business account</h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Verified vendor access is available to business accounts. Upgrade your account first, then continue the vendor profile, KYC, and membership steps.
              </p>
              <Button onClick={handleBusinessUpgrade} disabled={upgrading}>
                {upgrading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Upgrade to Business Account
              </Button>
            </CardContent>
          </Card>
        ) : isVerified ? (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="pt-6 text-center space-y-4">
              <Award className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto" />
              <h2 className="text-xl font-semibold">You're a verified vendor</h2>
              <p className="text-muted-foreground">
                Your business is showing the verified badge across the Accountabul marketplace.
              </p>
              <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {steps.map((step, idx) => {
              const StepHeaderIcon = step.icon;
              const stepKey = step.key as StepKey;
              const isExpanded = expandedStep === stepKey;
              const hasContent = !!(step.body || step.cta);
              return (
                <Card
                  key={step.key}
                  ref={(el) => { cardRefs.current[step.key] = el; }}
                  className={
                    step.status === 'done'
                      ? 'border-green-500/30'
                      : step.status === 'in_progress'
                      ? 'border-primary/40'
                      : ''
                  }
                >
                  <CardHeader
                    className="cursor-pointer select-none hover:bg-muted/30 transition-colors rounded-t-lg"
                    onClick={() => toggleStep(stepKey)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleStep(stepKey);
                      }
                    }}
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-start gap-4">
                      <StepIcon status={step.status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <StepHeaderIcon className="w-4 h-4 text-muted-foreground" />
                          <CardTitle className="text-base">
                            Step {idx + 1}: {step.title}
                          </CardTitle>
                          {step.status === 'done' && (
                            <Badge variant="outline" className="ml-auto text-green-700 dark:text-green-400 border-green-500/40">
                              Complete
                            </Badge>
                          )}
                        </div>
                        <CardDescription>{step.description}</CardDescription>
                      </div>
                      {hasContent && (
                        <div className="ml-2 text-muted-foreground shrink-0">
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  {hasContent && isExpanded && (
                    <CardContent>
                      {step.body}
                      {step.cta && (
                        <div className="flex justify-end">
                          <Button onClick={step.cta.onClick} variant={step.status === 'in_progress' ? 'default' : 'outline'}>
                            {step.cta.label}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}

            {allDone && (
              <Card className="border-primary/40 bg-primary/5">
                <CardContent className="pt-6 text-center space-y-3">
                  <Award className="w-10 h-10 text-primary mx-auto" />
                  <h3 className="font-semibold text-lg">All steps complete!</h3>
                  <p className="text-sm text-muted-foreground">
                    Our team will review your submission and issue your verified vendor badge shortly. You'll get a notification when it's live.
                  </p>
                  <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default VendorOnboarding;
