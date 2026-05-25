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

    const { data: applications, error: appsError } = await svc
      .from('credential_applications')
      .select(`
        id, user_id, wallet_address, credential_key, status, applied_at, reviewed_at,
        rejection_reason, issued_at, expires_at, accepted_at, revoked_at, revocation_reason,
        notes, wallet_credential_id,
        credential_catalog ( credential_name )
      `)
      .order('applied_at', { ascending: false })

    if (appsError) throw appsError

    const apps = applications ?? []
    const userIds = [...new Set(apps.map((app: any) => app.user_id).filter(Boolean))]
    const profileMap = new Map<string, string>()

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await svc
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', userIds)

      if (profilesError) throw profilesError

      for (const profile of profiles ?? []) {
        const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
        if (name) profileMap.set(profile.id, name)
      }
    }

    const enrichedApplications = apps.map((app: any) => ({
      ...app,
      _profile_name: profileMap.get(app.user_id) ?? null,
    }))

    return new Response(JSON.stringify({
      success: true,
      applications: enrichedApplications,
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
