import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Mail, Lock, ArrowRight, User, Building2, ShieldCheck } from 'lucide-react';

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const isAdminTab = searchParams.get('tab') === 'admin';
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [accountType, setAccountType] = useState('individual');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect authenticated users
  useEffect(() => {
    if (!authLoading && user) {
      if (isAdminTab) {
        // Check admin role before redirecting
        supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' }).then(({ data }) => {
          if (data) {
            navigate('/admin');
          } else {
            toast.error('Your account does not have admin access.');
            navigate('/dashboard');
          }
        });
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, authLoading, navigate, isAdminTab]);

  const handleTabChange = (value: string) => {
    if (value === 'admin') {
      navigate('/auth?tab=admin', { replace: true });
      setMode('login');
    } else {
      navigate('/auth', { replace: true });
    }
  };

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

        if (isAdminTab) {
          const { data: { user: loggedInUser } } = await supabase.auth.getUser();
          if (loggedInUser) {
            const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: loggedInUser.id, _role: 'admin' });
            if (!isAdmin) {
              toast.error('Your account does not have admin access.');
              navigate('/dashboard');
              return;
            }
          }
          toast.success('Welcome, Admin!');
          navigate('/admin');
        } else {
          toast.success('Welcome back!');
          navigate('/dashboard');
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;

        if (data.user) {
          await supabase
            .from('profiles' as any)
            .update({
              full_name: fullName,
              account_type: accountType,
              company_name: accountType === 'business' ? companyName : null,
            } as any)
            .eq('id', data.user.id);
        }

        toast.success('Check your email to verify your account.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="flex items-center justify-center px-4 py-24">
        <Card className="w-full max-w-md p-8 shadow-card">
          {/* Tab switcher */}
          <Tabs value={isAdminTab ? 'admin' : 'user'} onValueChange={handleTabChange} className="mb-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="user">User</TabsTrigger>
              <TabsTrigger value="admin" className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Admin
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              {isAdminTab
                ? 'Admin Sign In'
                : mode === 'login'
                ? 'Sign In'
                : mode === 'signup'
                ? 'Create Account'
                : 'Reset Password'}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {isAdminTab
                ? 'Sign in with your admin credentials'
                : mode === 'login'
                ? 'Access your tokenization dashboard'
                : mode === 'signup'
                ? 'Start tokenizing your real estate'
                : 'Enter your email to receive a reset link'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && !isAdminTab && (
              <>
                <div>
                  <Label htmlFor="fullName">Full Name *</Label>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="John Doe"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label>Account Type *</Label>
                  <Select value={accountType} onValueChange={setAccountType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">
                        <span className="flex items-center gap-2"><User className="w-4 h-4" /> Individual</span>
                      </SelectItem>
                      <SelectItem value="business">
                        <span className="flex items-center gap-2"><Building2 className="w-4 h-4" /> Business</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {accountType === 'business' && (
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
                : isAdminTab
                ? 'Sign In as Admin'
                : mode === 'login'
                ? 'Sign In'
                : mode === 'signup'
                ? 'Sign Up'
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
                  const { error } = await lovable.auth.signInWithOAuth("google", {
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
            {mode === 'login' && !isAdminTab && (
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
                  Don't have an account? Sign up
                </button>
              </>
            )}
            {mode === 'login' && isAdminTab && (
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="text-sm text-muted-foreground hover:underline block w-full"
              >
                Forgot password?
              </button>
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
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default Auth;
