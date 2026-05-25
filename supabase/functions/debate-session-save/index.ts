import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { createCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const corsHeaders = createCorsHeaders(req.headers.get('origin'))

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceKey) {
      throw new Error('Missing Supabase configuration')
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(supabaseUrl, anonKey)
    const { data: { user }, error: userError } = await userClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const topic = String(body?.topic ?? '').trim()
    const mode = String(body?.mode ?? 'debate').trim()
    const rounds = Number(body?.rounds ?? 3)
    const transcript = Array.isArray(body?.transcript) ? body.transcript : []

    if (!topic) {
      return new Response(JSON.stringify({ error: 'topic is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const svc = createClient(supabaseUrl, serviceKey)
    const { data, error } = await svc
      .from('ai_debate_sessions')
      .insert({
        user_id: user.id,
        topic,
        mode,
        rounds,
        transcript,
      })
      .select('id, topic, mode, rounds, transcript, created_at')
      .single()

    if (error) throw error

    return new Response(JSON.stringify({ success: true, session: data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in debate-session-save:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
