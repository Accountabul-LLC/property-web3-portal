import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PropertyReview {
  id: string;
  property_id: string;
  wallet_address: string;
  user_name: string | null;
  rating: number;
  comment: string | null;
  ownership_percentage: number;
  created_at: string;
}

export interface PropertyDocument {
  id: string;
  property_id: string;
  name: string;
  file_url: string;
  file_type: string;
  created_at: string;
}

export interface TokenOrder {
  id: string;
  property_id: string;
  wallet_address: string;
  side: string;
  price: number;
  quantity: number;
  filled_quantity: number;
  status: string;
  created_at: string;
}

export interface TokenPriceHistory {
  id: string;
  property_id: string;
  price: number;
  volume: number;
  recorded_at: string;
}

export function usePropertyReviews(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['property_reviews', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_reviews' as any)
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PropertyReview[];
    },
    enabled: !!propertyId,
  });
}

export function usePropertyDocuments(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['property_documents', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_documents' as any)
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PropertyDocument[];
    },
    enabled: !!propertyId,
  });
}

export function useTokenOrders(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['token_orders', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('token_orders' as any)
        .select('id, property_id, side, price, quantity, filled_quantity, status, created_at')
        .eq('property_id', propertyId)
        .eq('status', 'open')
        .order('price', { ascending: false });
      if (error) {
        const isRlsDenied =
          error.code === '42501' ||
          /permission denied|row-level security/i.test(error.message || '');
        if (isRlsDenied) return [];
        throw error;
      }
      return (data || []) as unknown as TokenOrder[];
    },
    enabled: !!propertyId,
  });
}

export function useTokenPriceHistory(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['token_price_history', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('token_price_history' as any)
        .select('*')
        .eq('property_id', propertyId)
        .order('recorded_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as TokenPriceHistory[];
    },
    enabled: !!propertyId,
  });
}
