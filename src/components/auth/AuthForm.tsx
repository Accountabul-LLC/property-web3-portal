import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Mail, Lock, ArrowRight, User, Building2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

export type AuthFormVariant = 'individual' | 'business';

interface AuthFormProps {
  variant: AuthFormVariant;
  title: string;
  subtitle: string;
  redirectAfterSignup: string;
  redirectAfterLogin?: string;
  showVendorOptIn?: boolean;
  vendorRedirect?: string;
}

const VARIANT_ICON: Record<AuthFormVariant, React.ComponentType<{ className?: string }>> = {
  individual: User,
  business: Building2,
};

export function AuthForm({
  variant,
  title,
  subtitle,
  redirectAfterSignup,
  redirectAfterLogin,
  showVendorOptIn = false,
  vendorRedirect = '/vendors/apply',
}: AuthFormProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const nextPath =
    (location.state as { next?: string } | null)?.next ??
    redirectAfterLogin ??
    redirectAfterSignup;

  const forcedAccountType = variant === 'individual' ? 'individual' : 'business';
  const requiresCompany = variant !== 'individual';

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [joinVendorNetwork, setJoinVendorNetwork] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      navigate(nextPath, { replace: true });
    }
  }, [user, authLoading, navigate, nextPath]);

  const HeaderIcon = VARIANT_ICON[variant];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success('Check your email for a password reset link.');
        setMode('login');
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Welcome back!');
        navigate(nextPath, { replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;

        if (data.user) {
          const trimmed = fullName.trim().replace(/\s+/g, ' ');
          const parts = trimmed.split(' ');
          const firstName = parts[0] ?? '';
          const lastName = parts.slice(1).join(' ');
          await supabase
            .from('profiles' as never)
            .update({
              full_name: trimmed,
              first_name: firstName,
              last_name: lastName,
              account_type: forcedAccountType,
              company_name: requiresCompany ? companyName : null,
            } as never)
            .eq('id' as never, data.user.id);
        }


        if (data.session) {
          toast.success('Account created! Welcome.');
          const dest = showVendorOptIn && joinVendorNetwork ? vendorRedirect : redirectAfterSignup;
          navigate(dest, { replace: true });
        } else {
          toast.success('Account created. Please sign in.');
          setMode('login');
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const otherVariantLinks: { label: string; to: string }[] = [];
  if (variant !== 'individual') otherVariantLinks.push({ label: 'Individual', to: '/auth/individual' });
  if (variant !== 'business') otherVariantLinks.push({ label: 'Business', to: '/auth/business' });


  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="flex items-center justify-center px-4 py-24">
        <Card className="w-full max-w-md p-8 shadow-card">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
              <HeaderIcon className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              {mode === 'forgot' ? 'Reset Password' : title}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {mode === 'forgot' ? 'Enter your email to receive a reset link' : subtitle}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <Label htmlFor="fullName">Full Name *</Label>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Doe"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                {requiresCompany && (
                  <div>
                    <Label htmlFor="companyName">Company Name *</Label>
                    <div className="relative mt-1">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="companyName"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Acme Properties LLC"
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                    required
                    minLength={6}
                  />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? 'Please wait...'
                : mode === 'login'
                ? 'Sign In'
                : mode === 'signup'
                ? 'Create Account'
                : 'Send Reset Link'}
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </form>

          {mode !== 'forgot' && (
            <div className="mt-6">
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 font-medium"
                onClick={async () => {
                  const { error } = await lovable.auth.signInWithOAuth('google', {
                    redirect_uri: window.location.origin,
                  });
                  if (error) {
                    toast.error(error.message || 'Google sign-in failed');
                  }
                }}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </Button>
            </div>
          )}

          <div className="text-center mt-6 space-y-2">
            {mode === 'login' && (
              <>
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-sm text-muted-foreground hover:underline block w-full"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="text-sm text-primary hover:underline block w-full"
                >
                  Don't have an account? Create one
                </button>
              </>
            )}
            {mode === 'signup' && (
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-sm text-primary hover:underline"
              >
                Already have an account? Sign in
              </button>
            )}
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-sm text-primary hover:underline"
              >
                Back to sign in
              </button>
            )}
          </div>

          {otherVariantLinks.length > 0 && (
            <div className="mt-6 pt-6 border-t border-border text-center">
              <p className="text-xs text-muted-foreground mb-2">Looking for a different sign-up?</p>
              <div className="flex justify-center gap-3 text-sm">
                {otherVariantLinks.map((link) => (
                  <button
                    key={link.to}
                    type="button"
                    onClick={() => navigate(link.to)}
                    className="text-primary hover:underline"
                  >
                    {link.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
      <Footer />
    </div>
  );
}
