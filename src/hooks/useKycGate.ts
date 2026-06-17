/**
 * useKycGate — single point that handles "kyc_required" responses from
 * any signing edge function and redirects the user to /kyc (or /kyc/status
 * for in-flight reviews). Matches KycGate.tsx route logic.
 *
 * Usage at every UI sign call site:
 *
 *   const gate = useKycGate();
 *   try {
 *     await gate.guard();                // optional client pre-check
 *     const { data, error } = await supabase.functions.invoke('xaman-send-payment', { ... });
 *     if (gate.handleEdgeResponse(data, error)) return; // redirected, abort
 *     // ...continue
 *   } catch (e) {
 *     if (gate.handleThrown(e)) return;   // redirected, abort
 *     throw e;
 *   }
 */
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ensureKycApproved } from '@/lib/signing/ensureKycApproved';
import {
  KycRequiredError,
  isKycRequiredError,
  kycErrorFromEdgeResponse,
} from '@/lib/signing/errors';

type KycStatusish = string | null | undefined;

function routeFor(status: KycStatusish): string {
  if (status === 'submitted' || status === 'under_review') return '/kyc/status';
  return '/kyc';
}

export function useKycGate() {
  const navigate = useNavigate();

  const redirect = useCallback((status: KycStatusish, message?: string) => {
    toast.error(message || 'Identity verification required to sign transactions.');
    navigate(routeFor(status), { replace: false });
  }, [navigate]);

  /** Throws KycRequiredError before opening the wallet popup. */
  const guard = useCallback(async () => {
    try {
      await ensureKycApproved();
    } catch (err) {
      if (err instanceof KycRequiredError) {
        redirect(err.kycStatus, err.message);
      }
      throw err;
    }
  }, [redirect]);

  /**
   * Inspect a Supabase edge-function response. Returns true if it was a
   * kyc_required response and the user has been redirected; in that case
   * the caller should stop processing.
   */
  const handleEdgeResponse = useCallback((data: unknown, error: unknown): boolean => {
    // supabase.functions.invoke surfaces 4xx as `error` (FunctionsHttpError)
    // with the JSON body on `error.context` (sometimes), or sometimes just
    // returns the body in `data` for non-2xx — handle both.
    const candidates: unknown[] = [data, error];
    if (error && typeof error === 'object' && 'context' in error) {
      candidates.push((error as { context?: unknown }).context);
    }
    for (const c of candidates) {
      const kyc = kycErrorFromEdgeResponse(c);
      if (kyc) {
        redirect(kyc.kycStatus, kyc.message);
        return true;
      }
    }
    return false;
  }, [redirect]);

  const handleThrown = useCallback((err: unknown): boolean => {
    if (isKycRequiredError(err)) {
      redirect((err as KycRequiredError).kycStatus, err.message);
      return true;
    }
    return false;
  }, [redirect]);

  return { guard, handleEdgeResponse, handleThrown };
}
