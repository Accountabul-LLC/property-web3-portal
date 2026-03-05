import React, { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, User, MapPin, Coins, Settings, Info, Upload, X, Loader2, ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  // XLS-24d metadata
  image_url: string;
  collection_name: string;
  collection_family: string;
  // RWA metadata
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

interface MPTFormProps {
  params: MPTParams;
  onChange: (params: MPTParams) => void;
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

const MPTForm: React.FC<MPTFormProps> = ({ params, onChange }) => {
  const set = (key: string, value: string | number) => onChange({ ...params, [key]: value });
  const setFlag = (key: keyof MPTParams['flags'], value: boolean) => {
    const newFlags = { ...params.flags, [key]: value };
    const newFee = key === 'can_transfer' && !value ? 0 : params.transfer_fee;
    onChange({ ...params, flags: newFlags, transfer_fee: newFee });
  };

  return (
    <div className="space-y-6">
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
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">The name investors will see for this asset</p>
        </div>

        <div>
          <Label htmlFor="mpt-desc">Description</Label>
          <Textarea
            id="mpt-desc"
            placeholder="Describe the property — location highlights, condition, investment thesis..."
            value={params.description}
            onChange={e => set('description', e.target.value)}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="mpt-collection">Collection Name</Label>
            <Input
              id="mpt-collection"
              placeholder="RWA Property Tokens"
              value={params.collection_name}
              onChange={e => set('collection_name', e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="mpt-family">Collection Family</Label>
            <Input
              id="mpt-family"
              placeholder="Real Estate"
              value={params.collection_family}
              onChange={e => set('collection_family', e.target.value)}
              className="mt-1"
            />
          </div>
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
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <Label htmlFor="mpt-city">City</Label>
            <Input id="mpt-city" placeholder="Miami" value={params.city} onChange={e => set('city', e.target.value)} className="mt-1" />
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
          <Input id="mpt-country" value={params.country} onChange={e => set('country', e.target.value)} className="mt-1" />
        </div>
      </Card>

      {/* Owner Information */}
      <Card className="p-4 space-y-4 border-primary/10">
        <SectionHeader icon={User} title="Owner / Issuer Information" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="mpt-owner">Full Name</Label>
            <Input id="mpt-owner" placeholder="Jane Doe" value={params.owner_name} onChange={e => set('owner_name', e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="mpt-email">Contact Email</Label>
            <Input id="mpt-email" type="email" placeholder="jane@example.com" value={params.owner_email} onChange={e => set('owner_email', e.target.value)} className="mt-1" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
          Owner info is stored on-chain in the token metadata. Use a business name if preferred.
        </p>
      </Card>

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
            <p className="text-xs text-muted-foreground mt-1">Fee collected by issuer on every transfer (0–50%)</p>
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
