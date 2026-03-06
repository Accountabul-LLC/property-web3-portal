import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ApprovedProperty {
  id: string;
  title: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  year_built: number | null;
  estimated_value: number | null;
  description: string | null;
  images: string[] | null;
}

export function useApprovedProperties() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['approved-properties', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('properties' as any)
        .select('id, title, address, city, state, zip, property_type, bedrooms, bathrooms, square_feet, year_built, estimated_value, description, images')
        .eq('owner_user_id', user.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ApprovedProperty[];
    },
    enabled: !!user,
  });
}
