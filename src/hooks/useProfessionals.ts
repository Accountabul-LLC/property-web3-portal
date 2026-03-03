import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Professional {
  id: string;
  name: string;
  title: string;
  description: string;
  service_type: string;
  location: string;
  rating: number;
  review_count: number;
  completed_jobs: number;
  response_time: string;
  price_range: string;
  verified: boolean;
  specialties: string[];
  wallet_address: string | null;
  created_at: string;
}

export function useProfessionals() {
  return useQuery({
    queryKey: ['professionals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('professionals' as any)
        .select('*')
        .order('rating', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Professional[];
    },
  });
}
