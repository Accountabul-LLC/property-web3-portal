import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

export const DEFAULT_EDGE_BODY_LIMIT_BYTES = 100_000;
export const XRPL_ADDRESS_REGEX = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

export type EdgeAuthContext = {
  authHeader: string;
  anonClient: ReturnType<typeof createClient>;
  supabaseUrl: string;
  user: { id: string };
};

export function jsonError(
  message: string,
  status = 400,
  corsHeaders: Record<string, string>,
  extra: Record<string, unknown> = {},
) {
  return new Response(JSON.stringify({ success: false, error: message, ...extra }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function isValidXRPLAddress(addr: string): boolean {
  return XRPL_ADDRESS_REGEX.test(addr);
}

export async function parseJsonBody<T = unknown>(
  req: Request,
  corsHeaders: Record<string, string>,
  maxBytes = DEFAULT_EDGE_BODY_LIMIT_BYTES,
): Promise<T | Response> {
  const contentLength = req.headers.get('content-length');
  if (contentLength) {
    const parsedLength = Number(contentLength);
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      return jsonError('Request body too large', 413, corsHeaders);
    }
  }

  if (!req.body) {
    return jsonError('Invalid request body', 400, corsHeaders);
  }

  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // Ignore cancellation failures; the request is already rejected.
        }
        return jsonError('Request body too large', 413, corsHeaders);
      }

      text += decoder.decode(value, { stream: true });
    }

    text += decoder.decode();
  } catch {
    return jsonError('Invalid request body', 400, corsHeaders);
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Ignore cleanup errors.
    }
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return jsonError('Invalid request body', 400, corsHeaders);
  }
}

export async function requireEdgeUser(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<EdgeAuthContext | Response> {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError('Authentication required', 401, corsHeaders);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await anonClient.auth.getUser(token);
  if (error || !user?.id) {
    return jsonError('Authentication required', 401, corsHeaders);
  }

  return { authHeader, anonClient, supabaseUrl, user: { id: user.id } };
}
