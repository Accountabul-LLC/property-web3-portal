import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import {
  sanitizeCurrencyCodeInput,
  sanitizeDecimalInput,
} from '@/lib/formValidation';

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
  const applyRlusdPreset = () => {
    onChange({ ...params, currency_code: 'RLUSD', amount: '10000' });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Quick preset:</span> Mint a mock <span className="font-mono">RLUSD</span> on Testnet to play with stablecoin flows.
        </div>
        <Button type="button" size="sm" variant="outline" onClick={applyRlusdPreset}>
          <Sparkles className="w-3.5 h-3.5 mr-1" />
          Test RLUSD
        </Button>
      </div>

      <div>
        <Label htmlFor="iou-currency">Currency Code</Label>
        <Input
          id="iou-currency"
          maxLength={20}
          placeholder="e.g. USD, ABC, RLUSD"
          value={params.currency_code}
          onChange={e => onChange({ ...params, currency_code: sanitizeCurrencyCodeInput(e.target.value) })}
          className="mt-1 uppercase font-mono"
        />
        <p className="text-xs text-muted-foreground mt-1">
          3 chars = standard XRPL currency. 4-20 chars (e.g. <span className="font-mono">RLUSD</span>) auto-encode to non-standard hex.
        </p>
      </div>
      <div>
        <Label htmlFor="iou-amount">Amount to Issue</Label>
        <Input
          id="iou-amount"
          type="text"
          inputMode="decimal"
          maxLength={20}
          placeholder="e.g. 10000"
          value={params.amount}
          onChange={e => onChange({ ...params, amount: sanitizeDecimalInput(e.target.value) })}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="iou-dest">Destination Wallet</Label>
        <Input
          id="iou-dest"
          placeholder="rXXXX... (must have trust line set)"
          value={params.destination}
          onChange={e => onChange({ ...params, destination: e.target.value.slice(0, 34) })}
          maxLength={34}
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
