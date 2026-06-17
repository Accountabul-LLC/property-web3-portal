// Shared KYC chokepoint for ALL signing edge functions.
//
// Usage:
//   const auth = await requireEdgeUser(req, corsHeaders);
//   if (auth instanceof Response) return auth;
//   const kycGate = await requireKyc(auth.user.id, corsHeaders);
//   if (kycGate instanceof Response) return kycGate;
//
// Returns a 403 Response (with kyc_required code) when the user is not
// approved AND is not an admin. Admins bypass per existing
// "KYC Admin Bypass" memory.
//
// SignIn-only payloads (xaman-create-payload) should NOT call this,
// because users need to connect a wallet before they can finish KYC.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { jsonError } from './auth.ts';

let cachedAdminClient: ReturnType<typeof createClient> | null = null;
function adminClient() {
  if (cachedAdminClient) return cachedAdminClient;
  cachedAdminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  return cachedAdminClient;
}

export type KycGateResult =
  | { ok: true; status: string; isAdmin: boolean }
  | Response;

export async function requireKyc(
  userId: string,
  corsHeaders: Record<string, string>,
): Promise<KycGateResult> {
  const svc = adminClient();

  // Admin bypass — check first so a misconfigured kyc_cases row never blocks admin work.
  try {
    const { data: isAdmin } = await svc.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    });
    if (isAdmin === true) {
      return { ok: true, status: 'admin_bypass', isAdmin: true };
    }
  } catch (err) {
    console.error('require-kyc: has_role check failed', err);
    // fall through to KYC check — fail closed, not open
  }

  const { data: status, error } = await svc.rpc('get_kyc_status', { p_user_id: userId });
  if (error) {
    console.error('require-kyc: get_kyc_status failed', error);
    return jsonError('Unable to verify identity status', 500, corsHeaders);
  }

  if (status !== 'approved') {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Identity verification required',
        code: 'kyc_required',
        kyc_status: status ?? 'not_started',
      }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  return { ok: true, status: 'approved', isAdmin: false };
}
