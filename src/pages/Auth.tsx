import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
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
import { Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Legacy /auth route.
 *
 * - Default: redirects to /auth/individual (the new dedicated route).
 * - ?tab=admin: keeps the admin sign-in form in place since admins still need
 *   a private entry point that doesn't expose signup.
 */
const Auth = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isAdminTab = searchParams.get('tab') === 'admin';

  if (!isAdminTab) {
    return <Navigate to="/auth/individual" replace state={location.state} />;
  }

  return <AdminAuthForm />;
};

function AdminAuthForm() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' }).then(({ data }) => {
        if (data) {
          navigate('/admin');
        } else {
          toast.error('Your account does not have admin access.');
          navigate('/dashboard');
        }
      });
    }
  }, [user, authLoading, navigate]);

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
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
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
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Authentication failed');
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
            <div className="mx-auto mb-4 inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              {mode === 'forgot' ? 'Reset Password' : 'Admin Sign In'}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {mode === 'forgot' ? 'Enter your email to receive a reset link' : 'Sign in with your admin credentials'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" className="pl-10" required />
              </div>
            </div>
            {mode !== 'forgot' && (
              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-10" required minLength={6} />
                </div>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In as Admin' : 'Send Reset Link'}
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </form>

          {mode === 'login' && (
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
                  if (error) toast.error(error.message || 'Google sign-in failed');
                }}
              >
                Continue with Google
              </Button>
            </div>
          )}

          <div className="text-center mt-6">
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'forgot' : 'login')}
              className="text-sm text-muted-foreground hover:underline"
            >
              {mode === 'login' ? 'Forgot password?' : 'Back to sign in'}
            </button>
          </div>
        </Card>
      </div>
      <Footer />
    </div>
  );
}

export default Auth;
