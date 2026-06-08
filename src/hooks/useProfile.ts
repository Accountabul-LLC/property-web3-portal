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
  'city' | 'state' | 'zip' | 'country' | 'avatar_url'
>>;

export function useProfile() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const meta = user?.user_metadata || {};
    const email = user?.email ?? null;

    const fetchProfile = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles' as any)
        .select('*')
        .eq('id', userId)
        .single();

      if (cancelled) return;

      if (error && error.code === 'PGRST116') {
        // Profile row missing - create it from user metadata
        const newProfile: any = {
          id: userId,
          email,
          full_name: meta.full_name || meta.name || null,
          first_name: meta.given_name || null,
          last_name: meta.family_name || null,
        };
        await supabase.from('profiles' as any).insert(newProfile as any);
        if (cancelled) return;
        setProfile(newProfile as Profile);
      } else if (!error && data) {
        const profileData = data as any as Profile;
        setProfile(profileData);

        // Backfill first/last name when missing.
        // Source 1: Google OAuth metadata (given_name/family_name).
        // Source 2: existing full_name string split on whitespace (email signups).
        if (!profileData.first_name && !profileData.last_name) {
          let first: string | null = null;
          let last: string | null = null;
          let derivedFullName: string | null = profileData.full_name ?? null;

          if (meta?.given_name) {
            first = meta.given_name || null;
            last = meta.family_name || null;
            derivedFullName = meta.full_name || derivedFullName;
          } else {
            const source = (profileData.full_name || meta?.full_name || meta?.name || '').trim();
            if (source) {
              const parts = source.replace(/\s+/g, ' ').split(' ');
              first = parts[0] ?? null;
              last = parts.length > 1 ? parts.slice(1).join(' ') : null;
              derivedFullName = source;
            }
          }

          if (first) {
            const backfill: Record<string, string | null> = {
              first_name: first,
              last_name: last,
              full_name: derivedFullName,
              updated_at: new Date().toISOString(),
            };
            await supabase
              .from('profiles' as any)
              .update(backfill as any)
              .eq('id', userId);
            if (cancelled) return;
            setProfile(prev => prev ? { ...prev, ...backfill } as Profile : null);
          }
        }
      }
      setLoading(false);
    };

    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [userId]);

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
