import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Info, Building2 } from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Seo } from '@/components/Seo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useListProperty } from '@/hooks/useListProperty';

interface VendorRow {
  id: string;
  company_name: string;
  business_email: string | null;
  business_phone: string | null;
}

export default function ListProperty() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { createStandardListing, submitting } = useListProperty();

  const [vendor, setVendor] = useState<VendorRow | null>(null);
  const [loadingVendor, setLoadingVendor] = useState(true);

  const [form, setForm] = useState({
    title: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    description: '',
    property_type: 'Single Family',
    bedrooms: '',
    bathrooms: '',
    square_feet: '',
    year_built: '',
    listing_price: '',
    contact_email: '',
    contact_phone: '',
    image_url: '',
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth?next=/list-property', { replace: true });
      return;
    }
    (async () => {
      const { data, error } = await (supabase.from('vendor_profiles') as any)
        .select('id, company_name, business_email, business_phone')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        console.error(error);
      }
      if (data) {
        setVendor(data as VendorRow);
        setForm((f) => ({
          ...f,
          contact_email: f.contact_email || (data as VendorRow).business_email || user.email || '',
          contact_phone: f.contact_phone || (data as VendorRow).business_phone || '',
        }));
      }
      setLoadingVendor(false);
    })();
  }, [user, authLoading, navigate]);

  const handlePlaceSelect = async (placeId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('places-details', { body: { placeId } });
      if (error) throw error;
      if (data) {
        setForm((f) => ({
          ...f,
          address: data.streetNumber && data.route ? `${data.streetNumber} ${data.route}` : f.address,
          city: data.city || f.city,
          state: data.state || f.state,
          zip: data.zip || f.zip,
        }));
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not auto-fill address');
    }
  };

  const update = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = async () => {
    if (!vendor) return;
    if (!form.title.trim() || !form.address.trim() || !form.city.trim() || !form.state.trim()) {
      toast.error('Title and full address are required');
      return;
    }
    if (!form.contact_email.trim() && !form.contact_phone.trim()) {
      toast.error('Provide at least one contact method');
      return;
    }
    try {
      const id = await createStandardListing({
        title: form.title.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        zip: form.zip.trim(),
        description: form.description.trim(),
        property_type: form.property_type,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
        square_feet: form.square_feet ? Number(form.square_feet) : null,
        year_built: form.year_built ? Number(form.year_built) : null,
        listing_price: form.listing_price ? Number(form.listing_price.replace(/,/g, '')) : null,
        contact_email: form.contact_email.trim(),
        contact_phone: form.contact_phone.trim(),
        images: form.image_url.trim() ? [form.image_url.trim()] : [],
        vendor_profile_id: vendor.id,
      });
      toast.success('Listing published');
      navigate(`/property/${id}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Could not publish listing');
    }
  };

  if (authLoading || loadingVendor) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="min-h-screen bg-background">
        <Seo title="List a Property | Accountabul" description="Post a standard real estate listing on Accountabul." path="/list-property" />
        <Navigation />
        <main className="container mx-auto max-w-2xl px-4 py-12">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Building2 className="w-6 h-6 text-primary" />
                <CardTitle>Business profile required</CardTitle>
              </div>
              <CardDescription>
                To post a property listing you need a business profile. It takes a couple of minutes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Standard (non-tokenized) listings on Accountabul can only be posted by businesses.
                Set up your business profile, then come back here to publish your listing.
              </p>
              <Button onClick={() => navigate('/vendors/apply')}>Set up business profile</Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Seo title="List a Property | Accountabul" description="Post a standard real estate listing on Accountabul." path="/list-property" />
      <Navigation />
      <main className="container mx-auto max-w-3xl px-4 py-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">List a Property</h1>
          <p className="text-muted-foreground mt-1">
            Posting as <span className="font-medium text-foreground">{vendor.company_name}</span>.
            This is a <span className="font-medium text-foreground">Standard Listing</span> — not a tokenized asset.
          </p>
        </div>

        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 flex gap-3 text-sm">
            <Info className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <p className="text-muted-foreground">
              Standard listings go live immediately after you publish. By posting, you confirm you have the right
              to advertise this property and that the information is accurate. Accountabul is a platform — we don't
              broker, escrow, or verify these listings.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Listing details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Listing title *</Label>
              <Input id="title" value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="3BR Bungalow near Downtown" maxLength={120} />
            </div>

            <div>
              <Label>Property type</Label>
              <Select value={form.property_type} onValueChange={(v) => update('property_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Single Family', 'Condo', 'Multi Family', 'Commercial', 'Land', 'Other'].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="address">Street address *</Label>
              <AddressAutocomplete
                id="address"
                value={form.address}
                onChange={(v) => update('address', v)}
                onPlaceSelect={handlePlaceSelect}
                maxLength={200}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="city">City *</Label>
                <Input id="city" value={form.city} onChange={(e) => update('city', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="state">State *</Label>
                <Input id="state" value={form.state} onChange={(e) => update('state', e.target.value)} maxLength={20} />
              </div>
              <div>
                <Label htmlFor="zip">ZIP</Label>
                <Input id="zip" value={form.zip} onChange={(e) => update('zip', e.target.value)} maxLength={12} />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label htmlFor="bedrooms">Beds</Label>
                <Input id="bedrooms" type="number" min={0} value={form.bedrooms} onChange={(e) => update('bedrooms', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="bathrooms">Baths</Label>
                <Input id="bathrooms" type="number" min={0} value={form.bathrooms} onChange={(e) => update('bathrooms', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="sqft">Sq ft</Label>
                <Input id="sqft" type="number" min={0} value={form.square_feet} onChange={(e) => update('square_feet', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="year">Year built</Label>
                <Input id="year" type="number" min={1800} value={form.year_built} onChange={(e) => update('year_built', e.target.value)} />
              </div>
            </div>

            <div>
              <Label htmlFor="price">List price (USD)</Label>
              <Input id="price" inputMode="decimal" placeholder="450000" value={form.listing_price} onChange={(e) => update('listing_price', e.target.value)} />
            </div>

            <div>
              <Label htmlFor="image">Cover image URL</Label>
              <Input id="image" placeholder="https://..." value={form.image_url} onChange={(e) => update('image_url', e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Paste a hosted image URL for now. Multi-photo upload coming soon.</p>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={5} value={form.description} onChange={(e) => update('description', e.target.value)} maxLength={2000} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How buyers reach you</CardTitle>
            <CardDescription>Shown publicly on your listing. Provide at least one.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="email">Contact email</Label>
              <Input id="email" type="email" value={form.contact_email} onChange={(e) => update('contact_email', e.target.value)} maxLength={255} />
            </div>
            <div>
              <Label htmlFor="phone">Contact phone</Label>
              <Input id="phone" type="tel" value={form.contact_phone} onChange={(e) => update('contact_phone', e.target.value)} maxLength={40} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate('/marketplace')}>Cancel</Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Publish listing
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
