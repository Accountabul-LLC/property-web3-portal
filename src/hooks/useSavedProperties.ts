import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import { toast } from 'sonner';
import type { Property } from '@/hooks/useProperties';

export interface SavedPropertyRow {
  id: string;
  wallet_address: string;
  property_id: string;
  created_at: string;
}

export interface SavedPropertyWithDetails extends SavedPropertyRow {
  properties: Property | null;
}

const DISALLOWED_SAVE_STATUSES = new Set(['sold', 'delisted', 'under_review']);

export function isSaveEligiblePropertyStatus(status: string | null | undefined) {
  if (!status) return true;
  return !DISALLOWED_SAVE_STATUSES.has(status.toLowerCase());
}

const savedPropertiesKey = (userId: string | undefined, walletAddress: string | null) => [
  'saved-properties',
  userId ?? 'guest',
  walletAddress ?? 'no-wallet',
];

export function useSavedProperties() {
  const { user, loading: authLoading } = useAuth();
  const { activeAddress } = useActiveWallet();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: savedPropertiesKey(user?.id, activeAddress),
    queryFn: async () => {
      if (!user || !activeAddress) return [];

      const { data, error } = await supabase.rpc('get_saved_properties_for_wallet', {
        p_wallet_address: activeAddress,
      });

      if (error) throw error;
      return (data || []) as unknown as SavedPropertyWithDetails[];
    },
    enabled: !!user && !!activeAddress && !authLoading,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!user || !activeAddress || !query.data?.length) return;

    const staleRows = query.data.filter((row) => !isSaveEligiblePropertyStatus(row.properties?.status));
    if (staleRows.length === 0) return;

    const prune = async () => {
      await Promise.all(
        staleRows.map(async (row) => {
          const { error } = await supabase
            .from('saved_properties' as any)
            .delete()
            .eq('wallet_address', activeAddress)
            .eq('property_id', row.property_id);

          if (error) throw error;
        })
      );
      await queryClient.invalidateQueries({ queryKey: savedPropertiesKey(user.id, activeAddress) });
    };

    prune().catch((error) => {
      console.error('Failed to prune stale saved properties:', error);
    });
  }, [activeAddress, query.data, queryClient, user]);

  return query;
}

export function useSavedPropertyIds() {
  const { data: savedProperties = [], ...rest } = useSavedProperties();
  return {
    ...rest,
    data: savedProperties
      .filter((row) => isSaveEligiblePropertyStatus(row.properties?.status))
      .map((row) => row.property_id),
  };
}

export function useToggleSavedProperty() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activeAddress } = useActiveWallet();

  return useMutation({
    mutationFn: async (propertyId: string) => {
      if (!user) {
        throw new Error('Sign in to save properties.');
      }
      if (!activeAddress) {
        throw new Error('Connect a wallet to save properties.');
      }

      const { data: existing, error: fetchError } = await supabase
        .from('saved_properties' as any)
        .select('id')
        .eq('wallet_address', activeAddress)
        .eq('property_id', propertyId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existing) {
        const { error } = await supabase
          .from('saved_properties' as any)
          .delete()
          .eq('wallet_address', activeAddress)
          .eq('property_id', propertyId);

        if (error) throw error;
        return { saved: false };
      }

      const { error } = await supabase
        .from('saved_properties' as any)
        .insert({
          wallet_address: activeAddress,
          property_id: propertyId,
        });

      if (error) throw error;
      return { saved: true };
    },
    onMutate: async (propertyId) => {
      if (!user || !activeAddress) return;
      const key = savedPropertiesKey(user.id, activeAddress);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SavedPropertyWithDetails[]>(key) ?? [];
      const exists = previous.some((row) => row.property_id === propertyId);
      const next = exists
        ? previous.filter((row) => row.property_id !== propertyId)
        : [
            {
              id: `optimistic-${propertyId}`,
              wallet_address: activeAddress,
              property_id: propertyId,
              created_at: new Date().toISOString(),
              properties: null,
            },
            ...previous,
          ];
      queryClient.setQueryData(key, next);
      return { key, previous };
    },
    onError: (error, _propertyId, context) => {
      if (context?.key && context.previous) {
        queryClient.setQueryData(context.key, context.previous);
      }
      toast.error(error instanceof Error ? error.message : 'Failed to update saved properties.');
    },
    onSuccess: (result) => {
      toast.success(result.saved ? 'Property saved.' : 'Removed from saved properties.');
    },
    onSettled: () => {
      if (user && activeAddress) {
        queryClient.invalidateQueries({ queryKey: savedPropertiesKey(user.id, activeAddress) });
      }
    },
  });
}
