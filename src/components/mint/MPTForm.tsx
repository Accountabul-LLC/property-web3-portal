import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export interface MPTParams {
  max_amount: string;
  asset_scale: number;
  flags: { transferable: boolean; clawback: boolean };
}

interface MPTFormProps {
  params: MPTParams;
  onChange: (params: MPTParams) => void;
}

const MPTForm: React.FC<MPTFormProps> = ({ params, onChange }) => {
  return (
    <div className="space-y-4">
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
        <p className="text-xs text-muted-foreground mt-1">Total tokens that can ever exist (leave empty for unlimited)</p>
      </div>
      <div>
        <Label htmlFor="mpt-scale">Asset Scale (decimal places)</Label>
        <Input
          id="mpt-scale"
          type="number"
          min={0}
          max={15}
          value={params.asset_scale}
          onChange={e => onChange({ ...params, asset_scale: Number(e.target.value) })}
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">0 = whole tokens, 2 = two decimal places like USD</p>
      </div>
      <div className="space-y-3">
        <Label>Flags</Label>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="mpt-transferable"
            checked={params.flags.transferable}
            onCheckedChange={v => onChange({ ...params, flags: { ...params.flags, transferable: !!v } })}
          />
          <label htmlFor="mpt-transferable" className="text-sm">Transferable</label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="mpt-clawback"
            checked={params.flags.clawback}
            onCheckedChange={v => onChange({ ...params, flags: { ...params.flags, clawback: !!v } })}
          />
          <label htmlFor="mpt-clawback" className="text-sm">Clawback enabled</label>
        </div>
      </div>
    </div>
  );
};

export default MPTForm;
