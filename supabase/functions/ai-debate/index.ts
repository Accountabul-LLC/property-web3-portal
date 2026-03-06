import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fallback context used only if CODEBASE_CONTEXT secret is not set
const FALLBACK_CONTEXT = `You are an AI assistant for an internal RWA (real-world asset) tokenization platform built on the XRP Ledger (XRPL). The platform tokenizes real estate as MPT, NFT, and IOU tokens. Users authenticate via Supabase Auth and connect XRPL wallets via Xaman.`

type Speaker = 'claude' | 'gpt'
type Mode = 'debate' | 'collaborate' | 'compare'

interface RequestBody {
  topic: string
  mode: Mode
  rounds: number
}

function modeInstruction(mode: Mode, other: string): string {
  switch (mode) {
    case 'debate':
      return `You are debating ${other}. Present your strongest reasoning. Challenge weak arguments directly. Aim for clarity, not consensus.`
    case 'collaborate':
      return `You are collaborating with ${other} to give the user the best possible answer. Build on what they said, fill in gaps, and work toward a concrete recommendation.`
    case 'compare':
      return `Give your independent analysis. Do not react to ${other}'s response — provide your own assessment so the user can compare perspectives.`
  }
}

function buildSystem(speaker: Speaker, mode: Mode, codebaseContext: string): string {
  const other = speaker === 'claude' ? 'ChatGPT (GPT-4o)' : 'Claude (claude-sonnet-4-6)'
  return `${codebaseContext}\n\nBe direct, substantive, and intellectually honest.\n\n${modeInstruction(mode, other)}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // --- Auth ---
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
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

  // --- Role check (team = admin) ---
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
  const { data: roleRow } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle()

  if (!roleRow) {
    return new Response('Forbidden', { status: 403, headers: corsHeaders })
  }

  // --- Load codebase context from secret ---
  const codebaseContext = Deno.env.get('CODEBASE_CONTEXT') ?? FALLBACK_CONTEXT

  // --- Parse body ---
  const { topic, mode, rounds }: RequestBody = await req.json()
  if (!topic?.trim()) {
    return new Response('Bad Request: topic required', { status: 400, headers: corsHeaders })
  }
  const safeRounds = Math.min(Math.max(Number(rounds) || 3, 1), 5)

  const claudeKey = Deno.env.get('ANTHROPIC_API_KEY')!
  const openaiKey = Deno.env.get('OPENAI_API_KEY')!

  // Message histories per AI
  type Msg = { role: 'user' | 'assistant'; content: string }
  const claudeHistory: Msg[] = [{ role: 'user', content: topic }]
  const gptHistory: Msg[] = [{ role: 'user', content: topic }]

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function write(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
      }

      async function streamClaude(turn: number): Promise<string> {
        write({ type: 'turn_start', speaker: 'claude', turn })

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': claudeKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            stream: true,
            system: buildSystem('claude', mode, codebaseContext),
            messages: claudeHistory,
          }),
        })

        if (!res.ok) {
          const msg = await res.text()
          write({ type: 'error', message: `Claude error: ${msg}` })
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
              if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                const text: string = parsed.delta.text
                fullText += text
                write({ type: 'chunk', speaker: 'claude', text })
              }
            } catch { /* skip */ }
          }
        }

        write({ type: 'turn_end', speaker: 'claude', turn, full_text: fullText })
        return fullText
      }

      async function streamGPT(turn: number): Promise<string> {
        write({ type: 'turn_start', speaker: 'gpt', turn })

        const messages = [
          { role: 'system', content: buildSystem('gpt', mode, codebaseContext) },
          ...gptHistory,
        ]

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            stream: true,
            messages,
          }),
        })

        if (!res.ok) {
          const msg = await res.text()
          write({ type: 'error', message: `GPT error: ${msg}` })
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
                write({ type: 'chunk', speaker: 'gpt', text })
              }
            } catch { /* skip */ }
          }
        }

        write({ type: 'turn_end', speaker: 'gpt', turn, full_text: fullText })
        return fullText
      }

      try {
        for (let round = 1; round <= safeRounds; round++) {
          const claudeReply = await streamClaude(round)
          if (!claudeReply) break

          claudeHistory.push({ role: 'assistant', content: claudeReply })
          if (mode !== 'compare') {
            gptHistory.push({ role: 'user', content: claudeReply })
          }

          const gptReply = await streamGPT(round)
          if (!gptReply) break

          gptHistory.push({ role: 'assistant', content: gptReply })
          if (mode !== 'compare') {
            claudeHistory.push({ role: 'user', content: gptReply })
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
