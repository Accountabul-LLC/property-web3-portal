const DEFAULT_ALLOWED_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  Deno.env.get('APP_URL') ?? 'https://accountabul.com',
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

export function createCorsHeaders(origin: string | null) {
  const allowedOrigins = loadAllowedOrigins();
  const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}
