import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AIAgent {
  id: string;
  name: string;
  type: string;
  description: string;
  role: string;
  rating: number;
  rating_count: number;
  tasks_completed: number;
  response_time: string;
  price_model: string;
  price_text: string;
  skills: string[];
  created_at: string;
}

export function useAIAgents() {
  return useQuery({
    queryKey: ['ai_agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agents' as any)
        .select('*')
        .order('tasks_completed', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AIAgent[];
    },
  });
}
