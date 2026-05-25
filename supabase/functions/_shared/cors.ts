const DEFAULT_ALLOWED_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  Deno.env.get('APP_URL') ?? 'https://accountabul.com',
];

// Hostname suffix patterns that are always allowed (Lovable preview + published domains).
const ALLOWED_HOSTNAME_SUFFIXES = [
  '.lovableproject.com',
  '.lovable.app',
  '.lovable.dev',
];

function loadAllowedOrigins() {
  const raw =
    Deno.env.get('APP_ALLOWED_ORIGINS') ??
    Deno.env.get('APP_ALLOWED_ORIGIN') ??
    DEFAULT_ALLOWED_ORIGINS.join(',');

  return Array.from(
    new Set(
      raw
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    )
  );
}

function isOriginAllowed(origin: string, allowList: string[]): boolean {
  if (allowList.includes(origin)) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'https:' && protocol !== 'http:') return false;
    return ALLOWED_HOSTNAME_SUFFIXES.some(
      (suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix),
    );
  } catch {
    return false;
  }
}

export function createCorsHeaders(origin: string | null) {
  const allowedOrigins = loadAllowedOrigins();
  const allowedOrigin = origin && isOriginAllowed(origin, allowedOrigins)
    ? origin
    : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}
