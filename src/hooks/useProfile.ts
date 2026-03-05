import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  account_type: string;
  company_name: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type ProfileUpdate = Partial<Pick<Profile,
  'full_name' | 'first_name' | 'last_name' | 'account_type' | 'company_name' |
  'phone' | 'date_of_birth' | 'gender' | 'address_line1' | 'address_line2' |
  'city' | 'state' | 'zip' | 'country'
>>;

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

      if (error && error.code === 'PGRST116') {
        // Profile row missing — create it from user metadata
        const meta = user.user_metadata || {};
        const newProfile: any = {
          id: user.id,
          email: user.email,
          full_name: meta.full_name || meta.name || null,
          first_name: meta.given_name || null,
          last_name: meta.family_name || null,
        };
        await supabase.from('profiles' as any).insert(newProfile as any);
        setProfile(newProfile as Profile);
      } else if (!error && data) {
        const profileData = data as any as Profile;
        setProfile(profileData);

        // Backfill from Google metadata for existing users
        const meta = user.user_metadata;
        if (meta && !profileData.first_name && meta.given_name) {
          const backfill: Record<string, string | null> = {
            first_name: meta.given_name || null,
            last_name: meta.family_name || null,
            full_name: meta.full_name || null,
            updated_at: new Date().toISOString(),
          };
          await supabase
            .from('profiles' as any)
            .update(backfill as any)
            .eq('id', user.id);
          setProfile(prev => prev ? { ...prev, ...backfill } as Profile : null);
        }
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  const updateProfile = async (updates: ProfileUpdate) => {
    if (!user) return { error: 'Not authenticated' };

    // Derive full_name from first + last
    const derivedUpdates: any = { ...updates, updated_at: new Date().toISOString() };
    if (updates.first_name !== undefined || updates.last_name !== undefined) {
      const first = updates.first_name ?? profile?.first_name ?? '';
      const last = updates.last_name ?? profile?.last_name ?? '';
      derivedUpdates.full_name = [first, last].filter(Boolean).join(' ') || null;
    }

    const { error } = await supabase
      .from('profiles' as any)
      .update(derivedUpdates as any)
      .eq('id', user.id);

    if (!error) {
      setProfile(prev => prev ? { ...prev, ...derivedUpdates } : null);
    }

    return { error: error?.message || null };
  };

  return { profile, loading, updateProfile };
}
