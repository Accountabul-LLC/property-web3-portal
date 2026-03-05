import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface IOUParams {
  currency_code: string;
  amount: string;
  destination: string;
}

interface IOUFormProps {
  params: IOUParams;
  onChange: (params: IOUParams) => void;
}

const IOUForm: React.FC<IOUFormProps> = ({ params, onChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="iou-currency">Currency Code (3 chars)</Label>
        <Input
          id="iou-currency"
          maxLength={3}
          placeholder="e.g. USD, ABC"
          value={params.currency_code}
          onChange={e => onChange({ ...params, currency_code: e.target.value.toUpperCase() })}
          className="mt-1 uppercase"
        />
        <p className="text-xs text-muted-foreground mt-1">Standard 3-letter currency code</p>
      </div>
      <div>
        <Label htmlFor="iou-amount">Amount to Issue</Label>
        <Input
          id="iou-amount"
          type="number"
          placeholder="e.g. 10000"
          value={params.amount}
          onChange={e => onChange({ ...params, amount: e.target.value })}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="iou-dest">Destination Wallet</Label>
        <Input
          id="iou-dest"
          placeholder="rXXXX... (must have trust line set)"
          value={params.destination}
          onChange={e => onChange({ ...params, destination: e.target.value })}
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">
          The recipient must first set a trust line to your wallet for this currency.
          IOU issuance is a 2-step process: TrustSet → Payment.
        </p>
      </div>
    </div>
  );
};

export default IOUForm;
