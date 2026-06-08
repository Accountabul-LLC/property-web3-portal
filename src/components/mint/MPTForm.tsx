import React, { useState, useRef } from 'react';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, User, MapPin, Coins, Settings, Info, Upload, X, Loader2, ImageIcon, FlaskConical, Shuffle, Link2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MPTUri {
  u: string;  // URI link
  c: 'website' | 'social' | 'docs' | 'other';  // category
  t: string;  // title
}

export interface MPTParams {
  name: string;
  description: string;
  max_amount: string;
  asset_scale: number;
  transfer_fee: number;
  flags: {
    can_lock: boolean;
    require_auth: boolean;
    can_escrow: boolean;
    can_trade: boolean;
    can_transfer: boolean;
    can_clawback: boolean;
  };
  // XLS-89 compressed metadata
  ticker: string;
  image_url: string;
  uris: MPTUri[];
  // RWA metadata (stored in `ai` freeform field)
  property_address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  property_type: string;
  owner_name: string;
  owner_email: string;
  estimated_value: string;
  bedrooms: string;
  bathrooms: string;
  square_feet: string;
  year_built: string;
}

export const mptParamsSchema = z.object({
  name: z.string().max(80, 'Token name must be at most 80 characters'),
  description: z.string().max(280, 'Description must be at most 280 characters'),
  max_amount: z.string().max(40, 'Total supply is too long'),
  asset_scale: z.number().int().min(0).max(15),
  transfer_fee: z.number().int().min(0).max(50000),
  flags: z.object({
    can_lock: z.boolean(),
    require_auth: z.boolean(),
    can_escrow: z.boolean(),
    can_trade: z.boolean(),
    can_transfer: z.boolean(),
    can_clawback: z.boolean(),
  }),
  ticker: z.string().max(10, 'Ticker must be at most 10 characters'),
  image_url: z.string().max(512, 'Image URL must be at most 512 characters'),
  uris: z.array(z.object({
    u: z.string().max(512, 'URI must be at most 512 characters'),
    c: z.enum(['website', 'social', 'docs', 'other']),
    t: z.string().max(100, 'URI title must be at most 100 characters'),
  })).max(5),
  property_address: z.string().max(200, 'Property address must be at most 200 characters'),
  city: z.string().max(100, 'City must be at most 100 characters'),
  state: z.string().max(100, 'State must be at most 100 characters'),
  zip: z.string().max(10, 'ZIP must be at most 10 characters'),
  country: z.string().max(100, 'Country must be at most 100 characters'),
  property_type: z.string().max(80, 'Property type must be at most 80 characters'),
  owner_name: z.string().max(120, 'Owner name must be at most 120 characters'),
  owner_email: z.string().email('Enter a valid contact email'),
  estimated_value: z.string().max(40, 'Estimated value is too long'),
  bedrooms: z.string().max(10, 'Bedrooms must be at most 10 characters'),
  bathrooms: z.string().max(10, 'Bathrooms must be at most 10 characters'),
  square_feet: z.string().max(20, 'Square footage must be at most 20 characters'),
  year_built: z.string().max(4, 'Year built must be at most 4 characters'),
});

interface MPTFormProps {
  params: MPTParams;
  onChange: (params: MPTParams) => void;
  network?: 'testnet' | 'mainnet';
}

const FLAG_OPTIONS: { key: keyof MPTParams['flags']; label: string; desc: string }[] = [
  { key: 'can_transfer', label: 'Can Transfer', desc: 'Tokens can be sent between non-issuer accounts' },
  { key: 'can_trade', label: 'Can Trade', desc: 'Holders can trade on the DEX' },
  { key: 'can_lock', label: 'Can Lock', desc: 'Issuer can lock tokens individually or globally' },
  { key: 'require_auth', label: 'Require Auth', desc: 'Holders must be authorized by issuer' },
  { key: 'can_escrow', label: 'Can Escrow', desc: 'Holders can place tokens in escrow' },
  { key: 'can_clawback', label: 'Can Clawback', desc: 'Issuer can clawback tokens from holders' },
];

const PROPERTY_TYPES = [
  'Single Family',
  'Multi-Family',
  'Condo / Apartment',
  'Townhouse',
  'Commercial',
  'Industrial',
  'Land / Lot',
  'Mixed-Use',
  'Other',
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
];

const SectionHeader = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
  <div className="flex items-center gap-2 pt-2 pb-1">
    <Icon className="w-4 h-4 text-primary" />
    <h4 className="text-sm font-semibold text-foreground">{title}</h4>
  </div>
);

/** Upload an image to token-logos bucket or paste a URL */
const TokenImageUpload = ({ value, onChange }: { value: string; onChange: (url: string) => void }) => {
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<'upload' | 'url'>(value && !value.includes('supabase') ? 'url' : 'upload');
  const fileRef = useRef<HTMLInputElement>(null);
  const previewUrl = value || null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'];
    if (!allowed.includes(file.type)) {
      toast.error('Please upload a JPG, PNG, WebP, SVG, or GIF image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB.');
      return;
    }
    setUploading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = authData.user;
      if (!user) {
        toast.error('Please sign in to upload token logos.');
        return;
      }
      const ext = file.name.split('.').pop() || 'png';
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('token-logos').upload(path, file, {
        cacheControl: '31536000',
        upsert: false,
      });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('token-logos').getPublicUrl(path);
      onChange(urlData.publicUrl);
      toast.success('Image uploaded!');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const clearImage = () => {
    onChange('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="mt-1 space-y-2">
      <div className="flex gap-1">
        <Button type="button" variant={mode === 'upload' ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => setMode('upload')}>
          <Upload className="w-3 h-3 mr-1" /> Upload
        </Button>
        <Button type="button" variant={mode === 'url' ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => setMode('url')}>
          <ImageIcon className="w-3 h-3 mr-1" /> URL
        </Button>
      </div>
      {mode === 'upload' ? (
        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml,image/gif" className="hidden" onChange={handleFileChange} />
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading…</> : <><Upload className="w-4 h-4 mr-2" /> Choose file</>}
          </Button>
          {previewUrl && (
            <div className="relative">
              <img src={previewUrl} alt="Token logo preview" className="w-12 h-12 rounded-lg object-cover border border-border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <button type="button" className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center" onClick={clearImage}>
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input placeholder="https://… or ipfs://…" value={value} onChange={(e) => onChange(e.target.value)} maxLength={512} className="flex-1" />
          {previewUrl && <img src={previewUrl} alt="preview" className="w-9 h-9 rounded object-cover border border-border flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {mode === 'upload' ? 'JPG, PNG, WebP, SVG or GIF - max 5 MB' : 'IPFS or HTTPS link to a property photo / token logo'}
      </p>
    </div>
  );
};

const RANDOM_PROPERTIES = [
  { name: 'Sunset Ridge Estate Token', ticker: 'SNST', address: '742 Evergreen Terrace', city: 'Miami', state: 'FL', type: 'Single Family' },
  { name: 'Harbor View Loft Token', ticker: 'HRBR', address: '88 Waterfront Drive', city: 'San Diego', state: 'CA', type: 'Condo / Apartment' },
  { name: 'Mountain Crest Villa Token', ticker: 'MTCR', address: '1200 Alpine Road', city: 'Denver', state: 'CO', type: 'Single Family' },
  { name: 'Palm Gardens Residence Token', ticker: 'PALM', address: '456 Palm Boulevard', city: 'Austin', state: 'TX', type: 'Townhouse' },
  { name: 'Coral Reef Beach House Token', ticker: 'CORAL', address: '221B Baker Street', city: 'Fort Lauderdale', state: 'FL', type: 'Single Family' },
  { name: 'Skyline Tower Unit Token', ticker: 'SKYL', address: '1600 Pennsylvania Ave', city: 'Chicago', state: 'IL', type: 'Condo / Apartment' },
  { name: 'Oakwood Manor Token', ticker: 'OAKW', address: '99 Oak Hill Lane', city: 'Portland', state: 'OR', type: 'Multi-Family' },
  { name: 'Desert Oasis Villa Token', ticker: 'DSER', address: '3050 Cactus Way', city: 'Scottsdale', state: 'AZ', type: 'Single Family' },
  { name: 'Lakefront Retreat Token', ticker: 'LAKE', address: '12 Lakeshore Drive', city: 'Nashville', state: 'TN', type: 'Single Family' },
  { name: 'Metro Mixed-Use Token', ticker: 'MTRO', address: '500 Commerce Street', city: 'Atlanta', state: 'GA', type: 'Mixed-Use' },
];

const RANDOM_OWNERS = [
  { name: 'Alice Johnson', email: 'alice@example.com' },
  { name: 'Bob Martinez', email: 'bob.martinez@example.com' },
  { name: 'Charlie Kim', email: 'charlie.k@example.com' },
  { name: 'Diana Patel', email: 'diana.p@example.com' },
  { name: 'Ethan Nakamura', email: 'ethan.n@example.com' },
  { name: 'Fiona O\'Brien', email: 'fiona.ob@example.com' },
];

const RANDOM_DESCRIPTIONS = [
  'Beautiful property in a prime location with modern amenities and excellent investment potential. Recently renovated with high-end finishes throughout.',
  'Charming residence featuring open floor plan, updated kitchen, and spacious backyard. Located in a top-rated school district.',
  'Stunning contemporary home with panoramic views, smart home features, and energy-efficient design. Minutes from downtown.',
  'Well-maintained property with strong rental history and consistent cash flow. Ideal for income-focused investors.',
  'Luxury living with resort-style amenities including pool, gym, and concierge services. Premium location near shopping and dining.',
];

const RANDOM_IMAGES = [
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
];

const rand = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

function generateTestData(): MPTParams {
  const prop = rand(RANDOM_PROPERTIES);
  const owner = rand(RANDOM_OWNERS);
  const ticker = prop.ticker;
  return {
    name: prop.name,
    description: rand(RANDOM_DESCRIPTIONS),
    ticker,
    image_url: rand(RANDOM_IMAGES),
    uris: [
      { u: `example.com/properties/${ticker.toLowerCase()}`, c: 'website' as const, t: 'Property Page' },
      { u: `example.com/docs/${ticker.toLowerCase()}`, c: 'docs' as const, t: 'Token Docs' },
    ],
    property_address: prop.address,
    city: prop.city,
    state: prop.state,
    zip: String(randInt(10000, 99999)),
    country: 'US',
    property_type: prop.type,
    owner_name: owner.name,
    owner_email: owner.email,
    estimated_value: String(randInt(1, 50) * 100000),
    bedrooms: String(randInt(1, 6)),
    bathrooms: String(randInt(1, 4)),
    square_feet: String(randInt(8, 50) * 100),
    year_built: String(randInt(1950, 2024)),
    max_amount: String(randInt(1, 10) * (Math.random() > 0.5 ? 10000 : 1000)),
    asset_scale: randInt(0, 2),
    transfer_fee: Math.random() > 0.5 ? randInt(100, 5000) : 0,
    flags: {
      can_transfer: Math.random() > 0.3,
      can_trade: Math.random() > 0.5,
      can_lock: Math.random() > 0.6,
      require_auth: Math.random() > 0.7,
      can_escrow: Math.random() > 0.6,
      can_clawback: Math.random() > 0.5,
    },
  };
}

const MPTForm: React.FC<MPTFormProps> = ({ params, onChange, network }) => {
  const set = (key: string, value: string | number) => onChange({ ...params, [key]: value });
  const setFlag = (key: keyof MPTParams['flags'], value: boolean) => {
    const newFlags = { ...params.flags, [key]: value };
    const newFee = key === 'can_transfer' && !value ? 0 : params.transfer_fee;
    onChange({ ...params, flags: newFlags, transfer_fee: newFee });
  };

  return (
    <div className="space-y-6">
      {network === 'testnet' && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <FlaskConical className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <span className="text-xs text-amber-500 font-medium">Testnet Mode</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/20"
            onClick={() => onChange(generateTestData())}
          >
            <Shuffle className="w-3 h-3 mr-1" />
            Generate Test Data
          </Button>
        </div>
      )}

      {/* Property Information */}
      <Card className="p-4 space-y-4 border-primary/10">
        <SectionHeader icon={Building2} title="Property Information" />

        <div>
          <Label htmlFor="mpt-name">Token Name *</Label>
          <Input
            id="mpt-name"
            placeholder="e.g. 123 Oak Street Token"
            value={params.name}
            onChange={e => set('name', e.target.value)}
            maxLength={80}
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">The name investors will see for this asset</p>
        </div>

        <div>
          <Label htmlFor="mpt-desc">Description</Label>
          <Textarea
            id="mpt-desc"
            placeholder="Describe the property - location highlights, condition, investment thesis..."
            value={params.description}
            onChange={e => set('description', e.target.value)}
            maxLength={280}
            className="mt-1"
            rows={3}
          />
        </div>

        <div>
          <Label>Token Image</Label>
          <TokenImageUpload
            value={params.image_url}
            onChange={(url) => set('image_url', url)}
          />
        </div>

        <div>
          <Label htmlFor="mpt-ticker">Ticker Symbol</Label>
          <Input
            id="mpt-ticker"
            placeholder="e.g. OAK"
            maxLength={5}
            value={params.ticker}
            onChange={e => set('ticker', e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase())}
            className="mt-1 uppercase"
          />
          <p className="text-xs text-muted-foreground mt-1">3-5 uppercase letters, auto-generated from name if blank</p>
        </div>

        <div>
          <Label htmlFor="mpt-type">Property Type</Label>
          <Select value={params.property_type} onValueChange={v => set('property_type', v)}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select property type" />
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPES.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <Label htmlFor="mpt-beds">Beds</Label>
            <Input id="mpt-beds" type="text" inputMode="numeric" placeholder="3" value={params.bedrooms} onChange={e => set('bedrooms', e.target.value.replace(/\D/g, ''))} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="mpt-baths">Baths</Label>
            <Input id="mpt-baths" type="text" inputMode="numeric" placeholder="2" value={params.bathrooms} onChange={e => set('bathrooms', e.target.value.replace(/\D/g, ''))} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="mpt-sqft">Sq Ft</Label>
            <Input id="mpt-sqft" type="text" inputMode="numeric" placeholder="1,800" value={params.square_feet ? Number(params.square_feet).toLocaleString('en-US') : ''} onChange={e => set('square_feet', e.target.value.replace(/\D/g, ''))} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="mpt-year">Year Built</Label>
            <Input id="mpt-year" type="text" inputMode="numeric" placeholder="2005" maxLength={4} value={params.year_built} onChange={e => set('year_built', e.target.value.replace(/\D/g, ''))} className="mt-1" />
          </div>
        </div>

        <div>
          <Label htmlFor="mpt-value">Estimated Value (USD)</Label>
          <Input
            id="mpt-value"
            type="text"
            inputMode="numeric"
            placeholder="$350,000"
            value={params.estimated_value ? `$${Number(params.estimated_value).toLocaleString('en-US')}` : ''}
            onChange={e => set('estimated_value', e.target.value.replace(/[^0-9]/g, ''))}
            className="mt-1"
          />
        </div>
      </Card>

      {/* Property Address */}
      <Card className="p-4 space-y-4 border-primary/10">
        <SectionHeader icon={MapPin} title="Property Address" />

        <div>
          <Label htmlFor="mpt-address">Street Address</Label>
          <Input
            id="mpt-address"
            placeholder="123 Main Street, Apt 4B"
            value={params.property_address}
            onChange={e => set('property_address', e.target.value)}
            maxLength={200}
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <Label htmlFor="mpt-city">City</Label>
            <Input id="mpt-city" placeholder="Miami" value={params.city} onChange={e => set('city', e.target.value)} maxLength={100} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="mpt-state">State</Label>
            <Select value={params.state} onValueChange={v => set('state', v)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="mpt-zip">ZIP</Label>
            <Input id="mpt-zip" placeholder="33101" maxLength={10} value={params.zip} onChange={e => set('zip', e.target.value)} className="mt-1" />
          </div>
        </div>

        <div>
          <Label htmlFor="mpt-country">Country</Label>
          <Input id="mpt-country" value={params.country} onChange={e => set('country', e.target.value)} maxLength={100} className="mt-1" />
        </div>
      </Card>

      {/* Owner Information */}
      <Card className="p-4 space-y-4 border-primary/10">
        <SectionHeader icon={User} title="Owner / Issuer Information" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="mpt-owner">Issuer Name *</Label>
            <Input id="mpt-owner" placeholder="Jane Doe or Acme Holdings" value={params.owner_name} onChange={e => set('owner_name', e.target.value)} maxLength={120} className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">Required by XLS-89 - the entity issuing this token</p>
          </div>
          <div>
            <Label htmlFor="mpt-email">Contact Email *</Label>
            <Input id="mpt-email" type="email" placeholder="jane@example.com" value={params.owner_email} onChange={e => set('owner_email', e.target.value)} maxLength={254} className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">Used for issuer contact and required before minting.</p>
          </div>
        </div>
      </Card>

      {/* URIs (XLS-89 `us` field) */}
      <Card className="p-4 space-y-4 border-primary/10">
        <SectionHeader icon={Link2} title="Links (URIs)" />
        <p className="text-xs text-muted-foreground -mt-2">
          Add website, docs, or social links. These are stored on-chain per the XLS-89 standard.
        </p>

        {params.uris.map((uri, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input
                placeholder="example.com/property"
                value={uri.u}
                maxLength={512}
                onChange={e => {
                  const newUris = [...params.uris];
                  newUris[idx] = { ...newUris[idx], u: e.target.value };
                  onChange({ ...params, uris: newUris });
                }}
              />
              <Select
                value={uri.c}
                onValueChange={v => {
                  const newUris = [...params.uris];
                  newUris[idx] = { ...newUris[idx], c: v as MPTUri['c'] };
                  onChange({ ...params, uris: newUris });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="docs">Docs</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Title (e.g. Property Page)"
                value={uri.t}
                maxLength={100}
                onChange={e => {
                  const newUris = [...params.uris];
                  newUris[idx] = { ...newUris[idx], t: e.target.value };
                  onChange({ ...params, uris: newUris });
                }}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-destructive hover:text-destructive"
              onClick={() => {
                const newUris = params.uris.filter((_, i) => i !== idx);
                onChange({ ...params, uris: newUris });
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}

        {params.uris.length < 5 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onChange({ ...params, uris: [...params.uris, { u: '', c: 'website', t: '' }] })}
          >
            <Plus className="w-3 h-3 mr-1" /> Add Link
          </Button>
        )}
      </Card>

      <p className="text-xs text-muted-foreground flex items-start gap-1.5 px-1">
        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
        Metadata is encoded on-chain using the XLS-89 compressed schema (≤1024 bytes). Required fields: ticker, name, icon, asset_class, issuer_name.
      </p>

      {/* Token Economics */}
      <Card className="p-4 space-y-4 border-primary/10">
        <SectionHeader icon={Coins} title="Token Economics" />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="mpt-max">Total Supply</Label>
              <Input
                id="mpt-max"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 100"
                maxLength={40}
                value={params.max_amount ? Number(params.max_amount).toLocaleString('en-US') : ''}
                onChange={e => set('max_amount', e.target.value.replace(/[^0-9]/g, ''))}
                className="mt-1"
              />
            <p className="text-xs text-muted-foreground mt-1">How many tokens represent this property</p>
          </div>
          <div>
            <Label htmlFor="mpt-scale">Decimal Places</Label>
              <Input
                id="mpt-scale"
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={params.asset_scale.toString()}
              onChange={e => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                const num = raw === '' ? 0 : Math.min(15, parseInt(raw, 10));
                set('asset_scale', num);
              }}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">0 = whole tokens, 2 = fractional (like cents)</p>
          </div>
        </div>

        {params.asset_scale > 0 && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-xs space-y-3">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <p className="text-primary font-semibold text-[11px] uppercase tracking-wider">Divisibility Preview</p>
            </div>
            <div className="grid gap-2 pl-3 border-l-2 border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">1 token</span>
                <span className="font-mono text-foreground font-semibold tracking-wide">
                  {'1.' + '0'.repeat(params.asset_scale)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Smallest unit</span>
                <span className="font-mono text-foreground font-semibold tracking-wide">
                  {'0.' + '0'.repeat(params.asset_scale - 1) + '1'}
                </span>
              </div>
              {params.max_amount && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Max supply</span>
                  <span className="font-mono text-foreground font-semibold tracking-wide">
                    {Number(params.max_amount).toLocaleString('en-US', {
                      minimumFractionDigits: params.asset_scale,
                      maximumFractionDigits: params.asset_scale,
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {params.flags.can_transfer && (
          <div>
            <Label htmlFor="mpt-fee">Transfer Fee</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                id="mpt-fee"
                type="number"
                min={0}
                max={50000}
                value={params.transfer_fee}
                onChange={e => onChange({ ...params, transfer_fee: Math.min(50000, Math.max(0, Number(e.target.value))) })}
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">
                = {(params.transfer_fee / 1000).toFixed(3)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Fee collected by issuer on every transfer (0-50%)</p>
          </div>
        )}
      </Card>

      {/* Token Permissions */}
      <Card className="p-4 space-y-3 border-primary/10">
        <SectionHeader icon={Settings} title="Token Permissions" />
        {FLAG_OPTIONS.map(({ key, label, desc }) => (
          <div key={key} className="flex items-start space-x-2">
            <Checkbox
              id={`mpt-${key}`}
              checked={params.flags[key]}
              onCheckedChange={v => setFlag(key, !!v)}
              className="mt-0.5"
            />
            <div>
              <label htmlFor={`mpt-${key}`} className="text-sm font-medium cursor-pointer">{label}</label>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
};

export default MPTForm;
