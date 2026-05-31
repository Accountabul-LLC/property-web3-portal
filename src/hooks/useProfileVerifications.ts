import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type VerificationSource = 'stripe_identity' | 'kyc_review' | 'oauth_google' | 'vendor_intake';

export interface ProfileFieldVerification {
  field_name: string;
  source: VerificationSource;
  verified_value: string;
  verified_at: string;
  metadata: Record<string, unknown>;
}

const ADDRESS_FIELDS = new Set(['address_line1', 'address_line2', 'city', 'state', 'zip', 'country']);

function normalize(value: unknown, field: string): string {
  if (value == null) return '';
  let s = String(value).trim().toLowerCase();
  if (ADDRESS_FIELDS.has(field)) {
    s = s.replace(/[.,#]/g, '').replace(/\s+/g, ' ');
  }
  return s;
}

export function isFieldVerified(
  fieldValue: unknown,
  verification: ProfileFieldVerification | undefined,
): boolean {
  if (!verification) return false;
  return normalize(fieldValue, verification.field_name) === normalize(verification.verified_value, verification.field_name);
}

export function useProfileVerifications() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['profile-verifications', user?.id ?? 'guest'],
    queryFn: async () => {
      if (!user) return [] as ProfileFieldVerification[];
      const { data, error } = await (supabase.rpc as any)('get_profile_verifications');
      if (error) throw error;
      return (data ?? []) as ProfileFieldVerification[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const byField = new Map<string, ProfileFieldVerification>();
  for (const row of query.data ?? []) byField.set(row.field_name, row);

  return {
    ...query,
    byField,
    getVerification: (field: string) => byField.get(field),
    isVerified: (field: string, value: unknown) => isFieldVerified(value, byField.get(field)),
  };
}
