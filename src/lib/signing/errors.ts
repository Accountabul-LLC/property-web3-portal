/**
 * Typed error thrown by useSignTransaction / ensureKycApproved when the
 * caller is not allowed to sign because KYC isn't approved. UI catches
 * this and routes the user to /kyc or /kyc/status.
 */
export class KycRequiredError extends Error {
  readonly code = 'kyc_required' as const;
  readonly kycStatus: string;
  constructor(kycStatus: string, message = 'Identity verification required') {
    super(message);
    this.name = 'KycRequiredError';
    this.kycStatus = kycStatus;
  }
}

export function isKycRequiredError(err: unknown): err is KycRequiredError {
  return err instanceof KycRequiredError
    || (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'kyc_required');
}

/**
 * Extract a kyc_required signal from a Supabase edge-function error
 * response shape. Edge functions return `{ success: false, code, kyc_status }`
 * with HTTP 403.
 */
export function kycErrorFromEdgeResponse(
  body: unknown,
): KycRequiredError | null {
  if (
    typeof body === 'object' &&
    body !== null &&
    (body as { code?: string }).code === 'kyc_required'
  ) {
    const status = (body as { kyc_status?: string }).kyc_status ?? 'not_started';
    const message = (body as { error?: string }).error ?? 'Identity verification required';
    return new KycRequiredError(status, message);
  }
  return null;
}
