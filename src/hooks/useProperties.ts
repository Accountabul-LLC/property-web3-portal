import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Property {
  id: string;
  title: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  description: string;
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  square_feet: number;
  year_built: number;
  amenities: string[];
  images: string[];
  status: string;
  price_per_token: number;
  total_tokens: number;
  tokens_available: number;
  projected_annual_return: number;
  projected_rental_yield: number;
  market_cap: number;
  estimated_value: number;
  owner_wallet: string | null;
  created_at: string;
  updated_at: string;
}

export function useProperties() {
  return useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Property[];
    },
  });
}

export function useProperty(id: string | undefined) {
  return useQuery({
    queryKey: ['property', id],
    queryFn: async () => {
      if (!id) throw new Error('No property ID');
      const { data, error } = await supabase
        .from('properties' as any)
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as unknown as Property;
    },
    enabled: !!id,
  });
}
