import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

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

const MPTForm: React.FC<MPTFormProps> = ({ params, onChange }) => {
  const setFlag = (key: keyof MPTParams['flags'], value: boolean) => {
    const newFlags = { ...params.flags, [key]: value };
    // If can_transfer is disabled, reset transfer_fee
    const newFee = key === 'can_transfer' && !value ? 0 : params.transfer_fee;
    onChange({ ...params, flags: newFlags, transfer_fee: newFee });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="mpt-name">Token Name</Label>
        <Input
          id="mpt-name"
          placeholder="e.g. My Property Token"
          value={params.name}
          onChange={e => onChange({ ...params, name: e.target.value })}
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">Human-readable name stored in token metadata</p>
      </div>

      <div>
        <Label htmlFor="mpt-desc">Description</Label>
        <Textarea
          id="mpt-desc"
          placeholder="Describe what this token represents..."
          value={params.description}
          onChange={e => onChange({ ...params, description: e.target.value })}
          className="mt-1"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="mpt-max">Maximum Supply</Label>
          <Input
            id="mpt-max"
            type="number"
            placeholder="e.g. 1000000"
            value={params.max_amount}
            onChange={e => onChange({ ...params, max_amount: e.target.value })}
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">Leave empty for unlimited</p>
        </div>
        <div>
          <Label htmlFor="mpt-scale">Asset Scale</Label>
          <Input
            id="mpt-scale"
            type="number"
            min={0}
            max={15}
            value={params.asset_scale}
            onChange={e => onChange({ ...params, asset_scale: Number(e.target.value) })}
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">Decimal places (0-15)</p>
        </div>
      </div>

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
          <p className="text-xs text-muted-foreground mt-1">0-50000 (0.000% to 50.000%). Fee collected by issuer on transfers.</p>
        </div>
      )}

      <div className="space-y-3">
        <Label>Flags</Label>
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
      </div>
    </div>
  );
};

export default MPTForm;
