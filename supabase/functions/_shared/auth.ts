import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

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
