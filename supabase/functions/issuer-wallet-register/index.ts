import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { createCorsHeaders } from '../_shared/cors.ts'
import { logAppAudit } from '../_shared/app-audit.ts'

async function requireAdmin(req: Request, corsHeaders: Record<string, string>) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return { errorResponse: new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }) }
  }

  const anonClient = createClient(supabaseUrl, supabaseAnonKey)
  const { data: { user } } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) {
    return { errorResponse: new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }) }
  }

  const svc = createClient(supabaseUrl, supabaseServiceKey)
  const { data: isAdmin } = await svc.rpc('has_role', { _user_id: user.id, _role: 'admin' })
  const { data: isCompliance } = await svc.rpc('has_role', { _user_id: user.id, _role: 'compliance_officer' })
  if (!isAdmin && !isCompliance) {
    return { errorResponse: new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }) }
  }

  return { user, svc }
}

Deno.serve(async (req) => {
  const corsHeaders = createCorsHeaders(req.headers.get('origin'))

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const auth = await requireAdmin(req, corsHeaders)
    if ('errorResponse' in auth) return auth.errorResponse

    const { user, svc } = auth
    const body = await req.json().catch(() => ({}))
    const issuerName = String(body?.issuer_name ?? '').trim()
    const issuerAddress = String(body?.issuer_address ?? '').trim()
    const environment = String(body?.environment ?? 'testnet').trim()
    const network = String(body?.network ?? 'testnet').trim()
    const secretEnvKey = String(body?.secret_env_key ?? '').trim()
    const notes = String(body?.notes ?? '').trim()

    if (!issuerName) throw new Error('issuer_name is required')
    if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(issuerAddress)) {
      throw new Error('Invalid XRPL address')
    }
    if (!['testnet', 'mainnet'].includes(environment)) {
      throw new Error('environment is invalid')
    }
    if (!['testnet', 'mainnet'].includes(network)) {
      throw new Error('network is invalid')
    }
    if (!secretEnvKey) throw new Error('secret_env_key is required')

    const { data, error } = await svc
      .from('xrpl_issuer_wallets')
      .insert({
        environment,
        issuer_name: issuerName,
        issuer_address: issuerAddress,
        network,
        status: 'active',
        secret_env_key: secretEnvKey,
        notes: notes || null,
        created_by: user.id,
      })
      .select('*')
      .single()
    if (error) throw error

    await Promise.all([
      logAppAudit(svc, {
        area: 'wallets',
        action: 'issuer_wallet_registered',
        entityType: 'xrpl_issuer_wallet',
        entityId: data.id,
        actorId: user.id,
        afterState: data ?? {},
        metadata: { origin: 'issuer-wallet-register' },
      }),
      svc.from('integration_audit_log').insert({
        agent_id: null,
        integration_type: 'xrpl_issuer_wallet',
        action: 'registered',
        actor_id: user.id,
        metadata: { origin: 'issuer-wallet-register' },
      }),
    ])

    return new Response(JSON.stringify({ success: true, issuer_wallet: data }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in issuer-wallet-register:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
