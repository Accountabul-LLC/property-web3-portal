import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { createCorsHeaders } from '../_shared/cors.ts'
import { logAppAudit } from '../_shared/app-audit.ts'

function sanitizeFiles(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

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

async function writeItemEvent(
  svc: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
) {
  await svc.from('action_item_events').insert(payload)
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

    if (!action) {
      return new Response(JSON.stringify({ error: 'action is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'create_many') {
      const rowsRaw = Array.isArray(body?.items) ? body.items : []
      if (rowsRaw.length === 0) {
        return new Response(JSON.stringify({ error: 'items are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const rows = rowsRaw.map((row: any) => ({
        created_by: user.id,
        source_thread_id: row.source_thread_id ?? null,
        source_type: row.source_type ?? 'debate',
        title: String(row.title ?? '').trim(),
        description: String(row.description ?? '').trim(),
        priority: String(row.priority ?? 'MEDIUM').toUpperCase(),
        files_json: sanitizeFiles(row.files_json ?? row.files ?? []),
        expected_outcome: String(row.expected_outcome ?? ''),
        acceptance_criteria: String(row.acceptance_criteria ?? ''),
        status: String(row.status ?? 'open'),
        github_sync_status: String(row.github_sync_status ?? 'none'),
      }))

      for (const row of rows) {
        if (!row.title) throw new Error('Action item title is required')
        if (!row.description) throw new Error('Action item description is required')
      }

      const { data, error } = await svc
        .from('action_items')
        .insert(rows)
        .select('id, title, description, priority, status, created_by, source_type, source_thread_id')
      if (error) throw error

      await Promise.all((data ?? []).map((item) =>
        Promise.all([
          writeItemEvent(svc, {
            action_item_id: item.id,
            event_type: 'created',
            actor_id: user.id,
            metadata: { origin: 'action-item-admin', source_type: item.source_type },
          }),
          logAppAudit(svc, {
            area: 'tasks',
            action: 'created',
            entityType: 'action_item',
            entityId: item.id,
            actorId: user.id,
            afterState: item as Record<string, unknown>,
            metadata: { origin: 'action-item-admin' },
          }),
        ])
      ))

      return new Response(JSON.stringify({ success: true, items: data ?? [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'update_status') {
      const id = String(body?.id ?? '').trim()
      const status = String(body?.status ?? '').trim()
      if (!id) throw new Error('id is required')
      if (!status) throw new Error('status is required')

      const { data: current, error: fetchError } = await svc
        .from('action_items')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (fetchError) throw fetchError
      if (!current) throw new Error('Action item not found')

      const update: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      }
      if (body?.completion_signal !== undefined) {
        update.completion_signal = String(body.completion_signal ?? '')
      }

      const { data, error } = await svc
        .from('action_items')
        .update(update)
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error

      await Promise.all([
        writeItemEvent(svc, {
          action_item_id: id,
          event_type: 'status_changed',
          actor_id: user.id,
          metadata: { from: current.status, to: status, origin: 'action-item-admin' },
        }),
        logAppAudit(svc, {
          area: 'tasks',
          action: 'status_changed',
          entityType: 'action_item',
          entityId: id,
          actorId: user.id,
          beforeState: current,
          afterState: data ?? {},
          metadata: { origin: 'action-item-admin' },
        }),
      ])

      return new Response(JSON.stringify({ success: true, item: data }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'delete') {
      const id = String(body?.id ?? '').trim()
      if (!id) throw new Error('id is required')

      const { data: current, error: fetchError } = await svc
        .from('action_items')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (fetchError) throw fetchError
      if (!current) throw new Error('Action item not found')

      const { error } = await svc.from('action_items').delete().eq('id', id)
      if (error) throw error

      await Promise.all([
        writeItemEvent(svc, {
          action_item_id: id,
          event_type: 'deleted',
          actor_id: user.id,
          metadata: { origin: 'action-item-admin' },
        }),
        logAppAudit(svc, {
          area: 'tasks',
          action: 'deleted',
          entityType: 'action_item',
          entityId: id,
          actorId: user.id,
          beforeState: current,
          metadata: { origin: 'action-item-admin' },
        }),
      ])

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'sync_github') {
      const id = String(body?.id ?? '').trim()
      if (!id) throw new Error('id is required')

      const { data: current, error: fetchError } = await svc
        .from('action_items')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (fetchError) throw fetchError
      if (!current) throw new Error('Action item not found')

      const update = {
        github_issue_url: body?.github_issue_url ?? null,
        github_issue_number: body?.github_issue_number ?? null,
        github_sync_status: String(body?.github_sync_status ?? 'synced'),
        github_repo: body?.github_repo ?? null,
        pushed_at: body?.pushed_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await svc
        .from('action_items')
        .update(update)
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error

      await Promise.all([
        writeItemEvent(svc, {
          action_item_id: id,
          event_type: 'github_synced',
          actor_id: user.id,
          metadata: { origin: 'action-item-admin', github_issue_number: data.github_issue_number },
        }),
        logAppAudit(svc, {
          area: 'tasks',
          action: 'github_synced',
          entityType: 'action_item',
          entityId: id,
          actorId: user.id,
          beforeState: current,
          afterState: data ?? {},
          metadata: { origin: 'action-item-admin' },
        }),
      ])

      return new Response(JSON.stringify({ success: true, item: data }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: `Unsupported action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in action-item-admin:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
