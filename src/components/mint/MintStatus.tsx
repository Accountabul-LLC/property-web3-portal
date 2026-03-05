import React from 'react';
import { CheckCircle, Clock, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MintStatusProps {
  status: 'draft' | 'pending' | 'signed' | 'validated' | 'failed';
  txHash?: string | null;
  network: string;
  error?: string | null;
  qrCode?: string | null;
  pushed?: boolean;
  onReset: () => void;
}

const MintStatus: React.FC<MintStatusProps> = ({ status, txHash, network, error, qrCode, pushed, onReset }) => {
  const explorerBase = network === 'testnet'
    ? 'https://testnet.xrpl.org/transactions/'
    : 'https://livenet.xrpl.org/transactions/';

  return (
    <div className="text-center space-y-6 py-4">
      {status === 'pending' && (
        <>
          <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
          <h3 className="text-lg font-semibold">Waiting for Signature</h3>
          <p className="text-sm text-muted-foreground">
            {pushed ? 'Check your Xaman app for a signing request.' : 'Scan the QR code in Xaman to sign.'}
          </p>
          {qrCode && !pushed && (
            <img src={qrCode} alt="Xaman QR Code" className="mx-auto w-48 h-48 rounded-lg border border-border" />
          )}
        </>
      )}

      {status === 'signed' && (
        <>
          <Clock className="w-12 h-12 mx-auto text-yellow-500" />
          <h3 className="text-lg font-semibold">Transaction Signed</h3>
          <p className="text-sm text-muted-foreground">Waiting for ledger validation...</p>
        </>
      )}

      {status === 'validated' && (
        <>
          <CheckCircle className="w-12 h-12 mx-auto text-success" />
          <h3 className="text-lg font-semibold">Token Created!</h3>
          {txHash && (
            <a
              href={`${explorerBase}${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              View on Explorer <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <div className="pt-2">
            <Button onClick={onReset} variant="outline">Mint Another Token</Button>
          </div>
        </>
      )}

      {status === 'failed' && (
        <>
          <XCircle className="w-12 h-12 mx-auto text-destructive" />
          <h3 className="text-lg font-semibold">Mint Failed</h3>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="pt-2">
            <Button onClick={onReset} variant="outline">Try Again</Button>
          </div>
        </>
      )}
    </div>
  );
};

export default MintStatus;
