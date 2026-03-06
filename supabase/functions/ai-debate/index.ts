import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fallback context used only if CODEBASE_CONTEXT secret is not set
const FALLBACK_CONTEXT = `You are an AI assistant for an internal RWA (real-world asset) tokenization platform built on the XRP Ledger (XRPL). The platform tokenizes real estate as MPT, NFT, and IOU tokens. Users authenticate via Supabase Auth and connect XRPL wallets via Xaman.`

type Speaker = 'claude' | 'gpt' | 'user'
type Mode = 'debate' | 'collaborate' | 'compare'

interface HistoryItem {
  speaker: Speaker
  text: string
}

interface RequestBody {
  topic: string
  mode: Mode
  history: HistoryItem[]
  round: number
  turnOffset: number
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

function buildSystem(speaker: 'claude' | 'gpt', mode: Mode, codebaseContext: string): string {
  const other = speaker === 'claude' ? 'ChatGPT (GPT-4o)' : 'Claude (claude-sonnet-4-6)'
  return `${codebaseContext}\n\nBe direct, substantive, and intellectually honest.\n\n${modeInstruction(mode, other)}`
}

type Msg = { role: 'user' | 'assistant'; content: string }

function buildClaudeHistory(topic: string, history: HistoryItem[], mode: Mode): Msg[] {
  const msgs: Msg[] = [{ role: 'user', content: topic }]
  for (const item of history) {
    if (item.speaker === 'claude') {
      msgs.push({ role: 'assistant', content: item.text })
    } else if (item.speaker === 'user') {
      msgs.push({ role: 'user', content: `[Human facilitator]: ${item.text}` })
    } else if (item.speaker === 'gpt' && mode !== 'compare') {
      msgs.push({ role: 'user', content: item.text })
    }
  }
  return msgs
}

function buildGPTHistory(topic: string, history: HistoryItem[], mode: Mode): Msg[] {
  const msgs: Msg[] = [{ role: 'user', content: topic }]
  for (const item of history) {
    if (item.speaker === 'gpt') {
      msgs.push({ role: 'assistant', content: item.text })
    } else if (item.speaker === 'user') {
      msgs.push({ role: 'user', content: `[Human facilitator]: ${item.text}` })
    } else if (item.speaker === 'claude' && mode !== 'compare') {
      msgs.push({ role: 'user', content: item.text })
    }
  }
  return msgs
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

  // --- Load codebase context dynamically from GitHub ---
  let codebaseContext = FALLBACK_CONTEXT
  try {
    const ghRes = await fetch(`${supabaseUrl}/functions/v1/github-agent`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'get_tree',
        owner: 'JibreelMuhammad',
        repo: 'property-web3-portal',
      }),
    })
    if (ghRes.ok) {
      const treeData = await ghRes.json()
      const filePaths = (treeData.files || [])
        .map((f: { path: string; size: number }) => `- ${f.path} (${f.size}b)`)
        .join('\n')
      codebaseContext = `${FALLBACK_CONTEXT}\n\n## Repository File Tree (JibreelMuhammad/property-web3-portal)\nYou have access to the following files in the codebase:\n${filePaths}\n\nWhen discussing code changes, reference specific file paths from this tree.`
    }
  } catch (e) {
    console.warn('Failed to fetch repo tree for context, using fallback:', e)
  }

  // --- Parse body ---
  const { topic, mode, history = [], round = 1, turnOffset = 0 }: RequestBody = await req.json()
  if (!topic?.trim()) {
    return new Response('Bad Request: topic required', { status: 400, headers: corsHeaders })
  }

  const claudeKey = Deno.env.get('ANTHROPIC_API_KEY')!
  const openaiKey = Deno.env.get('OPENAI_API_KEY')!

  const claudeMessages = buildClaudeHistory(topic, history, mode)
  const gptMessages = buildGPTHistory(topic, history, mode)

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function write(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
      }

      async function streamClaude(): Promise<string> {
        write({ type: 'turn_start', speaker: 'claude', turn: 1 })

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
            messages: claudeMessages,
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

        write({ type: 'turn_end', speaker: 'claude', turn: 1, full_text: fullText })
        return fullText
      }

      async function streamGPT(claudeReply: string): Promise<string> {
        write({ type: 'turn_start', speaker: 'gpt', turn: 2 })

        // GPT sees Claude's reply from this round (unless compare mode)
        const messages = [
          { role: 'system', content: buildSystem('gpt', mode, codebaseContext) },
          ...gptMessages,
          ...(mode !== 'compare' ? [{ role: 'user', content: claudeReply }] : []),
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

        write({ type: 'turn_end', speaker: 'gpt', turn: 2, full_text: fullText })
        return fullText
      }

      try {
        const claudeReply = await streamClaude()
        if (!claudeReply) {
          controller.close()
          return
        }

        const gptReply = await streamGPT(claudeReply)

        write({
          type: 'done',
          round,
          turn_offset: turnOffset,
          total_turns: 2,
          conversation_id: crypto.randomUUID(),
        })

        // suppress unused var warning
        void gptReply
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
