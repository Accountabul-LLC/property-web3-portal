import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export interface NFTParams {
  uri: string;
  flags: { transferable: boolean; burnable: boolean; onlyXRP: boolean };
}

interface NFTFormProps {
  params: NFTParams;
  onChange: (params: NFTParams) => void;
}

const NFTForm: React.FC<NFTFormProps> = ({ params, onChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="nft-uri">Token URI (IPFS or HTTPS)</Label>
        <Input
          id="nft-uri"
          placeholder="ipfs://Qm... or https://example.com/metadata.json"
          value={params.uri}
          onChange={e => onChange({ ...params, uri: e.target.value })}
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">Link to metadata/image for this NFT</p>
      </div>
      <div className="space-y-3">
        <Label>Flags</Label>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="nft-transferable"
            checked={params.flags.transferable}
            onCheckedChange={v => onChange({ ...params, flags: { ...params.flags, transferable: !!v } })}
          />
          <label htmlFor="nft-transferable" className="text-sm">Transferable</label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="nft-burnable"
            checked={params.flags.burnable}
            onCheckedChange={v => onChange({ ...params, flags: { ...params.flags, burnable: !!v } })}
          />
          <label htmlFor="nft-burnable" className="text-sm">Burnable</label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="nft-onlyxrp"
            checked={params.flags.onlyXRP}
            onCheckedChange={v => onChange({ ...params, flags: { ...params.flags, onlyXRP: !!v } })}
          />
          <label htmlFor="nft-onlyxrp" className="text-sm">Only XRP (sales only in XRP)</label>
        </div>
      </div>
    </div>
  );
};

export default NFTForm;
