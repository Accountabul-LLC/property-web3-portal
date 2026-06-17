import { supabase } from '@/integrations/supabase/client';
import { KycRequiredError } from './errors';

/**
 * Client-side KYC pre-check. Reads the cache populated by useKycStatus
 * (fast path), and on cache miss queries kyc_cases directly. Throws
 * KycRequiredError if the user is not approved.
 *
 * Note: this is a UX shortcut to avoid opening a wallet popup the user
 * won't be able to use. The real enforcement happens server-side in
 * require-kyc.ts. Admins are not checked here because the signing edge
 * function will allow them through anyway via its own admin bypass.
 */
export async function ensureKycApproved(): Promise<void> {
  const { data: userResp } = await supabase.auth.getUser();
  const user = userResp.user;
  if (!user) throw new Error('You must be signed in to sign transactions.');

  // Use service-side RPC so the rule lives in one place.
  const { data, error } = await supabase.rpc('get_kyc_status', { p_user_id: user.id });
  if (error) {
    // Don't block on a transient RPC failure — the edge function will re-check.
    console.warn('ensureKycApproved: get_kyc_status failed, deferring to server', error);
    return;
  }

  const status = (data ?? 'not_started') as string;
  if (status !== 'approved') {
    throw new KycRequiredError(status);
  }
}
