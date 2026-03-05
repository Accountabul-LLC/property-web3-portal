import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { User, Building2, Edit2, Save, Plus } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, updateProfile } = useProfile();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    account_type: 'individual',
    company_name: '',
    phone: '',
  });
  const [properties, setProperties] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        account_type: profile.account_type || 'individual',
        company_name: profile.company_name || '',
        phone: profile.phone || '',
      });
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    const fetchProperties = async () => {
      const { data } = await supabase
        .from('properties' as any)
        .select('id, title, status, city, state, created_at')
        .eq('owner_user_id', user.id)
        .order('created_at', { ascending: false });
      if (data) setProperties(data as any[]);
    };
    fetchProperties();
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await updateProfile(formData);
    if (error) {
      toast.error(error);
    } else {
      toast.success('Profile updated');
      setEditing(false);
    }
    setSaving(false);
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center py-24">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'default';
      case 'submitted': return 'secondary';
      case 'draft': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Dashboard
          </h1>
          <Button onClick={() => navigate('/tokenize')} className="gap-2">
            <Plus className="w-4 h-4" />
            Tokenize Property
          </Button>
        </div>

        {/* Profile Card */}
        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">{profile?.full_name || 'Your Profile'}</h2>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => editing ? handleSave() : setEditing(true)}
              disabled={saving}
            >
              {editing ? <><Save className="w-4 h-4 mr-1" /> Save</> : <><Edit2 className="w-4 h-4 mr-1" /> Edit</>}
            </Button>
          </div>

          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Full Name</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Account Type</Label>
                  <Select
                    value={formData.account_type}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, account_type: v }))}
                  >
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.account_type === 'business' && (
                  <div>
                    <Label>Company Name</Label>
                    <Input
                      value={formData.company_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Account Type</p>
                <p className="font-medium capitalize">{profile?.account_type || 'Individual'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Phone</p>
                <p className="font-medium">{profile?.phone || '—'}</p>
              </div>
              {profile?.account_type === 'business' && (
                <div>
                  <p className="text-muted-foreground">Company</p>
                  <p className="font-medium">{profile?.company_name || '—'}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Member Since</p>
                <p className="font-medium">
                  {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Properties */}
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Your Properties
        </h2>

        {properties.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">You haven't submitted any properties yet.</p>
            <Button onClick={() => navigate('/tokenize')}>Tokenize Your First Property</Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {properties.map((prop: any) => (
              <Card key={prop.id} className="p-4 flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                  <p className="font-medium">{prop.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {[prop.city, prop.state].filter(Boolean).join(', ') || 'No location'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={statusColor(prop.status) as any}>{prop.status}</Badge>
                  <p className="text-xs text-muted-foreground">
                    {new Date(prop.created_at).toLocaleDateString()}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Dashboard;
