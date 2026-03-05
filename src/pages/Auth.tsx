import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Mail, Lock, ArrowRight, User, Building2 } from 'lucide-react';

const Auth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [accountType, setAccountType] = useState('individual');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);

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
        navigate('/dashboard');
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;

        // Update profile with additional info (trigger auto-creates the row)
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
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {mode === 'login'
                ? 'Access your tokenization dashboard'
                : mode === 'signup'
                ? 'Start tokenizing your real estate'
                : 'Enter your email to receive a reset link'}
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
                : mode === 'login'
                ? 'Sign In'
                : mode === 'signup'
                ? 'Sign Up'
                : 'Send Reset Link'}
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </form>

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
                  Don't have an account? Sign up
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
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default Auth;
