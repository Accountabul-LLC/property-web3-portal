import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { createCorsHeaders } from '../_shared/cors.ts'

async function requireAdmin(req: Request, corsHeaders: Record<string, string>) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return {
      errorResponse: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    }
  }

  const anonClient = createClient(supabaseUrl, supabaseAnonKey)
  const { data: { user } } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) {
    return {
      errorResponse: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    }
  }

  const svc = createClient(supabaseUrl, supabaseServiceKey)
  const { data: isAdmin } = await svc.rpc('has_role', { _user_id: user.id, _role: 'admin' })
  const { data: isCompliance } = await svc.rpc('has_role', { _user_id: user.id, _role: 'compliance_officer' })
  if (!isAdmin && !isCompliance) {
    return {
      errorResponse: new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    }
  }

  return { user, svc }
}

Deno.serve(async (req) => {
  const corsHeaders = createCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const auth = await requireAdmin(req, corsHeaders)
    if ('errorResponse' in auth) return auth.errorResponse

    const { svc } = auth
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action ?? 'list').trim()

    if (action !== 'list') {
      return new Response(JSON.stringify({ error: `Unsupported action: ${action}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: credentials, error } = await svc
      .from('wallet_credentials')
      .select(`
        id, ledger_status, credential_type, issuer_address,
        tx_hash, issued_at, accepted_at, created_at, revoked_at,
        user_wallets ( wallet_address, user_id, network, label )
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    return new Response(JSON.stringify({
      success: true,
      credentials: credentials ?? [],
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
