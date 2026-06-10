// Shared error-message sanitizer for edge function catch handlers.
//
// Functions throw deliberate, user-facing Error messages ("Invalid destination
// address", "KYC required"), which are safe to return. Unexpected internal
// errors (Postgres, fetch internals, stack-bearing driver errors) must not
// reach clients — they leak schema and infrastructure details.

const INTERNAL_PATTERNS = [
  /violates .*constraint/i,
  /duplicate key value/i,
  /column .* does not exist/i,
  /relation .* does not exist/i,
  /syntax error/i,
  /permission denied/i,
  /password|secret|seed|api[_ ]?key|service_role/i,
  /supabase\.co|postgres|pgrst/i,
  /ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i,
];

export const safeErrorMessage = (error: unknown, fallback = 'Internal error'): string => {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  if (!msg || msg.length > 300) return fallback;
  if (INTERNAL_PATTERNS.some((re) => re.test(msg))) return fallback;
  return msg;
};
