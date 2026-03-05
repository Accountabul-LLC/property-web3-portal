import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  account_type: string;
  company_name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles' as any)
        .select('*')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setProfile(data as any as Profile);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  const updateProfile = async (updates: Partial<Pick<Profile, 'full_name' | 'account_type' | 'company_name' | 'phone'>>) => {
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('profiles' as any)
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq('id', user.id);

    if (!error) {
      setProfile(prev => prev ? { ...prev, ...updates } : null);
    }

    return { error: error?.message || null };
  };

  return { profile, loading, updateProfile };
}
