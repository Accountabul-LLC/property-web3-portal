import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions'

const FALLBACK_CONTEXT = `You are an AI assistant for an internal RWA (real-world asset) tokenization platform built on the XRP Ledger (XRPL). The platform tokenizes real estate as MPT, NFT, and IOU tokens. Users authenticate via Supabase Auth and connect XRPL wallets via Xaman.`

type Speaker = 'gemini' | 'gpt'
type Mode = 'debate' | 'collaborate' | 'compare'

interface AgentConfig {
  id: Speaker
  label: string
  model: string
}

const AGENTS: Record<Speaker, AgentConfig> = {
  gemini: { id: 'gemini', label: 'Gemini Pro', model: 'google/gemini-3-flash-preview' },
  gpt: { id: 'gpt', label: 'GPT-5 Mini', model: 'openai/gpt-5-mini' },
}

interface RequestBody {
  topic: string
  mode: Mode
  rounds: number
  agents?: { a: Speaker; b: Speaker }
}

function modeInstruction(mode: Mode, otherLabel: string): string {
  switch (mode) {
    case 'debate':
      return `You are debating ${otherLabel}. Present your strongest reasoning. Challenge weak arguments directly. Aim for clarity, not consensus.`
    case 'collaborate':
      return `You are collaborating with ${otherLabel} to give the user the best possible answer. Build on what they said, fill in gaps, and work toward a concrete recommendation.`
    case 'compare':
      return `Give your independent analysis. Do not react to ${otherLabel}'s response — provide your own assessment so the user can compare perspectives.`
  }
}

function buildSystem(speaker: Speaker, mode: Mode, codebaseContext: string): string {
  const other = speaker === 'gemini' ? AGENTS.gpt.label : AGENTS.gemini.label
  return `${codebaseContext}\n\nBe direct, substantive, and intellectually honest.\n\n${modeInstruction(mode, other)}`
}

async function streamAgent(
  apiKey: string,
  agent: AgentConfig,
  mode: Mode,
  codebaseContext: string,
  messages: { role: string; content: string }[],
  turn: number,
  write: (event: Record<string, unknown>) => void,
): Promise<string> {
  write({ type: 'turn_start', speaker: agent.id, turn })

  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: agent.model,
      stream: true,
      messages: [
        { role: 'system', content: buildSystem(agent.id, mode, codebaseContext) },
        ...messages,
      ],
    }),
  })

  if (!res.ok) {
    const msg = await res.text()
    if (res.status === 429) {
      write({ type: 'error', message: 'Rate limit exceeded. Please try again in a moment.' })
      return ''
    }
    if (res.status === 402) {
      write({ type: 'error', message: 'AI usage limit reached. Please add credits to your workspace.' })
      return ''
    }
    write({ type: 'error', message: `${agent.label} error (${res.status}): ${msg}` })
    return ''
  }

  let fullText = ''
  const reader = res.body!.getReader()
  const dec = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue
      try {
        const parsed = JSON.parse(data)
        const text: string | undefined = parsed.choices?.[0]?.delta?.content
        if (text) {
          fullText += text
          write({ type: 'chunk', speaker: agent.id, text })
        }
      } catch { /* skip partial JSON */ }
    }
  }

  write({ type: 'turn_end', speaker: agent.id, turn, full_text: fullText })
  return fullText
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // --- Auth ---
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const authHeader = req.headers.get('Authorization')

  if (!authHeader) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  }

  const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  }

  // --- Role check (admin only) ---
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: roleRow } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle()

  if (!roleRow) {
    return new Response('Forbidden', { status: 403, headers: corsHeaders })
  }

  // --- Lovable AI Gateway key ---
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!lovableApiKey) {
    return new Response(
      JSON.stringify({ error: 'LOVABLE_API_KEY is not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // --- Load codebase context ---
  const codebaseContext = Deno.env.get('CODEBASE_CONTEXT') ?? FALLBACK_CONTEXT

  // --- Parse body ---
  const { topic, mode, rounds, agents: agentSelection }: RequestBody = await req.json()
  if (!topic?.trim()) {
    return new Response('Bad Request: topic required', { status: 400, headers: corsHeaders })
  }
  const safeRounds = Math.min(Math.max(Number(rounds) || 3, 1), 5)

  const agentA = AGENTS[agentSelection?.a ?? 'gemini']
  const agentB = AGENTS[agentSelection?.b ?? 'gpt']

  // Message histories per agent
  type Msg = { role: 'user' | 'assistant'; content: string }
  const historyA: Msg[] = [{ role: 'user', content: topic }]
  const historyB: Msg[] = [{ role: 'user', content: topic }]

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function write(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
      }

      // Send agent metadata so frontend knows who is who
      write({
        type: 'agents',
        agent_a: { id: agentA.id, label: agentA.label, model: agentA.model },
        agent_b: { id: agentB.id, label: agentB.label, model: agentB.model },
      })

      try {
        for (let round = 1; round <= safeRounds; round++) {
          const replyA = await streamAgent(lovableApiKey, agentA, mode, codebaseContext, historyA, round, write)
          if (!replyA) break

          historyA.push({ role: 'assistant', content: replyA })
          if (mode !== 'compare') {
            historyB.push({ role: 'user', content: replyA })
          }

          const replyB = await streamAgent(lovableApiKey, agentB, mode, codebaseContext, historyB, round, write)
          if (!replyB) break

          historyB.push({ role: 'assistant', content: replyB })
          if (mode !== 'compare') {
            historyA.push({ role: 'user', content: replyB })
          }
        }

        write({
          type: 'done',
          total_turns: safeRounds * 2,
          conversation_id: crypto.randomUUID(),
        })
      } catch (e: unknown) {
        write({ type: 'error', message: e instanceof Error ? e.message : 'Unknown error' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
})
