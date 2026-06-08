// Builds a lookup map of XRPL transaction hashes → donation context
// for a given wallet. Used to relabel generic Escrow/Payment transactions
// as user-facing "donation" events when they were created via our platform.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type DonationRole = 'donor' | 'recipient';

export interface DonationContext {
  donation_id: string;
  campaign_id: string;
  campaign_title: string | null;
  campaign_slug: string | null;
  amount: number;
  currency: string;
  role: DonationRole;
  /** 'escrow_create' = the original escrow funding; 'escrow_finish' = release/payout */
  stage: 'escrow_create' | 'escrow_finish';
  counterparty: string | null;
}

export type DonationLookup = Map<string, DonationContext>;

export function useDonationLookup(walletAddress: string | null) {
  return useQuery({
    queryKey: ['donation_lookup', walletAddress],
    queryFn: async (): Promise<DonationLookup> => {
      const map: DonationLookup = new Map();
      if (!walletAddress) return map;

      // Donations where this wallet is the DONOR (RLS: donor_user_id = auth.uid())
      const { data: asDonor } = await supabase
        .from('campaign_donations')
        .select(
          'id, campaign_id, amount, currency, escrow_tx_hash, escrow_finish_tx_hash, donor_wallet_address, campaigns:campaign_id(title, slug, recipient_wallet_address)'
        )
        .eq('donor_wallet_address', walletAddress);

      // Donations where this wallet is the RECIPIENT - public view of escrowed/released only
      const { data: asRecipient } = await supabase
        .from('campaign_donations')
        .select(
          'id, campaign_id, amount, currency, escrow_tx_hash, escrow_finish_tx_hash, donor_wallet_address, campaigns:campaign_id!inner(title, slug, recipient_wallet_address)'
        )
        .in('escrow_status', ['escrowed', 'released'])
        .eq('campaigns.recipient_wallet_address', walletAddress);

      const rows = [
        ...(asDonor || []).map((r) => ({ row: r, role: 'donor' as const })),
        ...(asRecipient || []).map((r) => ({ row: r, role: 'recipient' as const })),
      ];

      for (const { row, role } of rows) {
        const campaign = (row as any).campaigns || {};
        const counterparty =
          role === 'donor'
            ? campaign.recipient_wallet_address ?? null
            : (row as any).donor_wallet_address ?? null;
        const base = {
          donation_id: (row as any).id,
          campaign_id: (row as any).campaign_id,
          campaign_title: campaign.title ?? null,
          campaign_slug: campaign.slug ?? null,
          amount: Number((row as any).amount ?? 0),
          currency: (row as any).currency ?? 'XRP',
          role,
          counterparty,
        };
        if ((row as any).escrow_tx_hash) {
          map.set((row as any).escrow_tx_hash, { ...base, stage: 'escrow_create' });
        }
        if ((row as any).escrow_finish_tx_hash) {
          map.set((row as any).escrow_finish_tx_hash, { ...base, stage: 'escrow_finish' });
        }
      }

      return map;
    },
    enabled: !!walletAddress,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

/** Human-readable label for a donation-tagged transaction. */
export function donationLabel(ctx: DonationContext): string {
  const amt = ctx.amount
    ? `${ctx.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${ctx.currency}`
    : `${ctx.currency}`;
  if (ctx.role === 'donor') {
    return ctx.stage === 'escrow_finish'
      ? `Donation delivered (${amt})`
      : `You donated ${amt}`;
  }
  // recipient
  return ctx.stage === 'escrow_finish'
    ? `Donation received: ${amt}`
    : `Incoming donation pledged: ${amt}`;
}
