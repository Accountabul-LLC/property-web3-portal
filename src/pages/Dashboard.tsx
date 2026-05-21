import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import { WalletRegistrationPanel } from '@/components/WalletRegistrationPanel';
import { WalletHistoryPanel } from '@/components/WalletHistoryPanel';
import Footer from '@/components/Footer';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import { useSavedPropertyIds } from '@/hooks/useSavedProperties';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { User, Building2, Edit2, Save, Plus, Wallet, Trash2, Pencil, Check, X, AlertCircle, Camera, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useKycStatus } from '@/hooks/useKycStatus';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

// Phone formatting helper
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function unformatPhone(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10);
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, updateProfile } = useProfile();
  const { wallets, walletsLoading, openConnectModal, removeWallet, renameWallet, activeWallet } = useActiveWallet();
  const { data: savedPropertyIds = [] } = useSavedPropertyIds();
  const { status: kycStatus, isApproved: kycApproved } = useKycStatus();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    account_type: 'individual',
    company_name: '',
    phone: '',
    date_of_birth: '',
    gender: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip: '',
    country: 'US',
  });
  const [properties, setProperties] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingWalletAddr, setEditingWalletAddr] = useState<string | null>(null);
  const [walletLabel, setWalletLabel] = useState('');
  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a valid image (JPEG, PNG, WebP, GIF, or SVG)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    setUploadingAvatar(true);
    const ext = file.name.split('.').pop();
    const filePath = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error('Upload failed: ' + uploadError.message);
      setUploadingAvatar(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const avatarUrl = urlData.publicUrl + '?t=' + Date.now();

    await updateProfile({ avatar_url: avatarUrl } as any);
    toast.success('Profile picture updated!');
    setUploadingAvatar(false);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        account_type: profile.account_type || 'individual',
        company_name: profile.company_name || '',
        phone: profile.phone ? formatPhone(profile.phone) : '',
        date_of_birth: profile.date_of_birth || '',
        gender: profile.gender || '',
        address_line1: profile.address_line1 || '',
        address_line2: profile.address_line2 || '',
        city: profile.city || '',
        state: profile.state || '',
        zip: profile.zip || '',
        country: profile.country || 'US',
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
    // Validation
    if (!formData.first_name.trim()) {
      toast.error('First name is required');
      return;
    }
    if (!formData.last_name.trim()) {
      toast.error('Last name is required');
      return;
    }
    if (formData.phone && unformatPhone(formData.phone).length > 0 && unformatPhone(formData.phone).length < 10) {
      toast.error('Please enter a complete 10-digit phone number');
      return;
    }
    if (formData.zip && !/^\d{5}(-\d{4})?$/.test(formData.zip) && formData.zip.length > 0) {
      toast.error('Please enter a valid ZIP code');
      return;
    }
    if (formData.date_of_birth) {
      const dob = new Date(formData.date_of_birth);
      const now = new Date();
      if (dob > now) {
        toast.error('Date of birth cannot be in the future');
        return;
      }
      const age = (now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (age < 18) {
        toast.error('You must be at least 18 years old');
        return;
      }
    }

    setSaving(true);
    const { error } = await updateProfile({
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      account_type: formData.account_type,
      company_name: formData.account_type === 'business' ? formData.company_name.trim() : null,
      phone: unformatPhone(formData.phone) || null,
      date_of_birth: formData.date_of_birth || null,
      gender: formData.gender || null,
      address_line1: formData.address_line1.trim() || null,
      address_line2: formData.address_line2.trim() || null,
      city: formData.city.trim() || null,
      state: formData.state || null,
      zip: formData.zip.trim() || null,
      country: formData.country || 'US',
    });
    if (error) {
      toast.error(error);
    } else {
      toast.success('Profile updated');
      setEditing(false);
    }
    setSaving(false);
  };

  const handleRenameWallet = (addr: string) => {
    if (walletLabel.trim()) {
      renameWallet(addr, walletLabel.trim());
      setEditingWalletAddr(null);
      toast.success('Wallet renamed');
    }
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

  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.full_name || 'Your Profile';

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      {/* KYC status banner */}
      {(kycStatus === 'submitted' || kycStatus === 'under_review') ? (
        <div className="bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800 px-4 py-2.5 flex items-center justify-center gap-3 text-sm text-blue-800 dark:text-blue-200">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>Your identity verification is under review. We'll notify you when it's complete.</span>
        </div>
      ) : !kycApproved ? (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 flex items-center justify-center gap-3 text-sm text-amber-800 dark:text-amber-200">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>Complete identity verification to unlock minting and trading.</span>
          <button onClick={() => navigate('/kyc')} className="font-medium underline underline-offset-2 hover:no-underline">
            Start KYC →
          </button>
        </div>
      ) : null}
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

        {/* Complete Profile Banner */}
        {profile && (!profile.first_name || !profile.phone) && !editing && (
          <Card className="p-4 mb-4 border-primary/30 bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Complete your profile</p>
                  <p className="text-xs text-muted-foreground">Add your name and contact info to unlock all features.</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Complete Now
              </Button>
            </div>
          </Card>
        )}

        {/* Profile Card */}
        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="relative group w-12 h-12 rounded-full overflow-hidden cursor-pointer"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                title="Click to upload profile picture"
              >
                <Avatar className="w-12 h-12">
                  {profile?.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={displayName} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10">
                    <User className="w-6 h-6 text-primary" />
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  <Camera className="w-4 h-4 text-white" />
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </button>
              <div>
                <h2 className="text-xl font-semibold">{displayName}</h2>
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
            <div className="space-y-5">
              {/* Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>First Name <span className="text-destructive">*</span></Label>
                  <Input
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder="John"
                    className="mt-1"
                    maxLength={50}
                  />
                </div>
                <div>
                  <Label>Last Name <span className="text-destructive">*</span></Label>
                  <Input
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder="Doe"
                    className="mt-1"
                    maxLength={50}
                  />
                </div>
              </div>

              {/* Phone & DOB */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Phone Number</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                    placeholder="(555) 123-4567"
                    className="mt-1"
                    type="tel"
                  />
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <Input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData(prev => ({ ...prev, date_of_birth: e.target.value }))}
                    className="mt-1"
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              {/* Gender & Account Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Gender</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, gender: v }))}
                  >
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select gender" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="non-binary">Non-Binary</SelectItem>
                      <SelectItem value="prefer-not-to-say">Prefer Not to Say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
              </div>

              {/* Company (conditional) */}
              {formData.account_type === 'business' && (
                <div>
                  <Label>Company Name</Label>
                  <Input
                    value={formData.company_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                    placeholder="Acme Corp"
                    className="mt-1"
                    maxLength={100}
                  />
                </div>
              )}

              {/* Address */}
              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Address</p>
                <div className="space-y-3">
                  <div>
                    <Label>Street Address</Label>
                    <Input
                      value={formData.address_line1}
                      onChange={(e) => setFormData(prev => ({ ...prev, address_line1: e.target.value }))}
                      placeholder="123 Main St"
                      className="mt-1"
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <Label>Apt / Suite / Unit</Label>
                    <Input
                      value={formData.address_line2}
                      onChange={(e) => setFormData(prev => ({ ...prev, address_line2: e.target.value }))}
                      placeholder="Apt 4B"
                      className="mt-1"
                      maxLength={100}
                    />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="col-span-2 md:col-span-1">
                      <Label>City</Label>
                      <Input
                        value={formData.city}
                        onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                        placeholder="New York"
                        className="mt-1"
                        maxLength={100}
                      />
                    </div>
                    <div>
                      <Label>State</Label>
                      <Select
                        value={formData.state}
                        onValueChange={(v) => setFormData(prev => ({ ...prev, state: v }))}
                      >
                        <SelectTrigger className="mt-1"><SelectValue placeholder="State" /></SelectTrigger>
                        <SelectContent>
                          {US_STATES.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>ZIP</Label>
                      <Input
                        value={formData.zip}
                        onChange={(e) => setFormData(prev => ({ ...prev, zip: e.target.value.replace(/[^\d-]/g, '').slice(0, 10) }))}
                        placeholder="10001"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Cancel button */}
              <div className="flex justify-end">
                <Button variant="ghost" onClick={() => setEditing(false)} className="mr-2">Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="w-4 h-4 mr-1" /> Save Changes
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">First Name</p>
                <p className="font-medium">{profile?.first_name || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Name</p>
                <p className="font-medium">{profile?.last_name || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Phone</p>
                <p className="font-medium">{profile?.phone ? formatPhone(profile.phone) : '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date of Birth</p>
                <p className="font-medium">{profile?.date_of_birth ? new Date(profile.date_of_birth + 'T00:00:00').toLocaleDateString() : '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Gender</p>
                <p className="font-medium capitalize">{profile?.gender?.replace('-', ' ') || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Account Type</p>
                <p className="font-medium capitalize">{profile?.account_type || 'Individual'}</p>
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
              {(profile?.address_line1 || profile?.city) && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">Address</p>
                  <p className="font-medium">
                    {[profile?.address_line1, profile?.address_line2].filter(Boolean).join(', ')}
                    {profile?.city && <><br />{[profile?.city, profile?.state, profile?.zip].filter(Boolean).join(', ')}</>}
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Connected Wallets */}
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          Connected Wallets
        </h2>

        <Card className="p-6 mb-8">
          {walletsLoading ? (
            <p className="text-muted-foreground text-sm">Loading wallets...</p>
          ) : wallets.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">No wallets connected yet.</p>
              <Button onClick={openConnectModal} className="gap-2">
                <Wallet className="w-4 h-4" />
                Connect Your First Wallet
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {wallets.map((w) => {
                return (
                <div key={w.address} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    {editingWalletAddr === w.address ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={walletLabel}
                          onChange={(e) => setWalletLabel(e.target.value)}
                          className="h-8 text-sm max-w-[200px]"
                          onKeyDown={(e) => e.key === 'Enter' && handleRenameWallet(w.address)}
                          autoFocus
                        />
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleRenameWallet(w.address)}>
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingWalletAddr(null)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium text-sm">{w.label}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate">{w.address}</p>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Connected {new Date(w.connectedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setEditingWalletAddr(w.address);
                        setWalletLabel(w.label);
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => {
                        removeWallet(w.address);
                        toast.success('Wallet disconnected');
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                );
              })}
              <Button variant="outline" onClick={openConnectModal} className="w-full mt-2 gap-2">
                <Plus className="w-4 h-4" />
                Connect Another Wallet
              </Button>
            </div>
          )}
        </Card>

        {/* Trading Compliance */}
        <div className="mb-8">
          <WalletRegistrationPanel />
        </div>

        {/* Wallet History */}
        <div className="mb-8">
          <WalletHistoryPanel />
        </div>

        {/* Saved Homes */}
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
            {savedPropertyIds.length}
          </span>
          Saved Homes
        </h2>

        <Card className="p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-medium">Your saved homes list</p>
              <p className="text-sm text-muted-foreground">
                Saved properties are available without KYC and stay tied to your account and active wallet.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{savedPropertyIds.length} saved</Badge>
              <Button variant="outline" onClick={() => navigate('/marketplace?tab=saved')}>
                Open Saved List
              </Button>
            </div>
          </div>
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
              <Card
                key={prop.id}
                className="p-4 flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  if (prop.status === 'draft') {
                    navigate(`/tokenize?edit=${prop.id}`);
                  } else {
                    navigate(`/tokenize?edit=${prop.id}`);
                  }
                }}
              >
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
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); navigate(`/tokenize?edit=${prop.id}`); }}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
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
