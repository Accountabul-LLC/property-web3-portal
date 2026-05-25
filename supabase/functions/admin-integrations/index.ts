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
  if (!isAdmin) {
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
    const action = String(body?.action ?? '').trim()
    const agentId = String(body?.agent_id ?? '').trim()
    const integrationType = String(body?.integration_type ?? 'github').trim()

    if (!action) {
      return new Response(JSON.stringify({ error: 'action is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (integrationType !== 'github') {
      return new Response(JSON.stringify({ error: 'Only github integrations are supported' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'toggle') {
      if (!agentId) throw new Error('agent_id is required')
      const enabled = !!body?.enabled
      const { data: current } = await svc
        .from('agent_integrations')
        .select('*')
        .eq('agent_id', agentId)
        .eq('integration_type', integrationType)
        .maybeSingle()

      const { data, error } = await svc
        .from('agent_integrations')
        .upsert({
          agent_id: agentId,
          integration_type: integrationType,
          enabled,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'agent_id,integration_type' })
        .select('*')
        .single()
      if (error) throw error

      await Promise.all([
        svc.from('integration_audit_log').insert({
          agent_id: agentId,
          integration_type: integrationType,
          action: enabled ? 'enabled' : 'disabled',
          actor_id: user.id,
          metadata: { origin: 'admin-integrations' },
        }),
        logAppAudit(svc, {
          area: 'integrations',
          action: enabled ? 'enabled' : 'disabled',
          entityType: 'agent_integration',
          entityId: data.id,
          actorId: user.id,
          beforeState: current ?? {},
          afterState: data ?? {},
          metadata: { origin: 'admin-integrations' },
        }),
      ])

      return new Response(JSON.stringify({ success: true, integration: data }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'global_toggle') {
      const enabled = !!body?.enabled
      const globalAgentId = '00000000-0000-0000-0000-000000000000'
      const { data: current } = await svc
        .from('agent_integrations')
        .select('*')
        .eq('agent_id', globalAgentId)
        .eq('integration_type', integrationType)
        .maybeSingle()

      const { data, error } = await svc
        .from('agent_integrations')
        .upsert({
          agent_id: globalAgentId,
          integration_type: integrationType,
          enabled,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'agent_id,integration_type' })
        .select('*')
        .single()
      if (error) throw error

      await Promise.all([
        svc.from('integration_audit_log').insert({
          agent_id: null,
          integration_type: integrationType,
          action: enabled ? 'connected' : 'disconnected',
          actor_id: user.id,
          metadata: { scope: 'global', origin: 'admin-integrations' },
        }),
        logAppAudit(svc, {
          area: 'integrations',
          action: enabled ? 'connected' : 'disconnected',
          entityType: 'agent_integration',
          entityId: data.id,
          actorId: user.id,
          beforeState: current ?? {},
          afterState: data ?? {},
          metadata: { scope: 'global', origin: 'admin-integrations' },
        }),
      ])

      return new Response(JSON.stringify({ success: true, integration: data }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: `Unsupported action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in admin-integrations:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
