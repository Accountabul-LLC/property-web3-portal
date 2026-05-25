import { supabase } from '@/integrations/supabase/client'

type EdgeFunctionBody = Record<string, unknown>

export async function callEdgeFunction<T = unknown>(
  fn: string,
  body: EdgeFunctionBody,
  options: { requireAuth?: boolean } = {}
): Promise<T> {
  const requireAuth = options.requireAuth ?? true
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (requireAuth && !session) throw new Error('Not authenticated')
  if (session) {
    headers.Authorization = `Bearer ${session.access_token}`
  }

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || res.statusText)
  return json as T
}
