import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FALLBACK_CONTEXT = `You are an AI assistant for an internal RWA (real-world asset) tokenization platform built on the XRP Ledger (XRPL). The platform tokenizes real estate as MPT, NFT, and IOU tokens. Users authenticate via Supabase Auth and connect XRPL wallets via Xaman.`

const TREE_CACHE_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours

type Speaker = 'claude' | 'gpt' | 'gemini' | 'user'
type Mode = 'debate' | 'collaborate' | 'compare' | 'conclude'

interface ConversationMessage {
  role: 'user' | 'agent' | 'assistant' | 'system'
  speaker?: string
  content: string
  timestamp?: string
}

interface HistoryItem { speaker: Speaker; text: string }
interface RequestBody {
  topic: string
  mode: Mode
  history: HistoryItem[]
  round: number
  turnOffset: number
  selectedFiles?: string[]
  transcript_summary?: string
  conversation_messages?: ConversationMessage[]
  thread_id?: string
}

// ─── Memory helpers ───────────────────────────────────────────

async function getCachedTree(
  supabaseAdmin: ReturnType<typeof createClient>,
  supabaseUrl: string,
  authHeader: string,
): Promise<string> {
  // Check cache
  const { data: cached } = await supabaseAdmin
    .from('agent_memory')
    .select('content, updated_at')
    .eq('category', 'shared')
    .eq('key', 'repo_file_tree')
    .maybeSingle()

  if (cached) {
    const age = Date.now() - new Date(cached.updated_at).getTime()
    if (age < TREE_CACHE_TTL_MS) {
      console.log('Using cached file tree (age:', Math.round(age / 60000), 'min)')
      return cached.content
    }
  }

  // Fetch fresh tree
  console.log('Fetching fresh file tree from GitHub...')
  try {
    const ghRes = await fetch(`${supabaseUrl}/functions/v1/github-agent`, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_tree', owner: 'JibreelMuhammad', repo: 'property-web3-portal' }),
    })
    if (!ghRes.ok) throw new Error(`GitHub tree fetch failed: ${ghRes.status}`)
    const treeData = await ghRes.json()
    const filePaths = (treeData.files || [])
      .map((f: { path: string; size: number }) => `- ${f.path} (${f.size}b)`)
      .join('\n')

    // Cache in agent_memory (upsert using service role)
    await supabaseAdmin.from('agent_memory').upsert(
      { user_id: '00000000-0000-0000-0000-000000000000', category: 'shared', key: 'repo_file_tree', content: filePaths, metadata: { file_count: treeData.files?.length || 0 } },
      { onConflict: 'user_id,key' }
    )

    return filePaths
  } catch (e) {
    console.warn('Failed to fetch repo tree:', e)
    return ''
  }
}

async function fetchFileContents(
  paths: string[],
  supabaseUrl: string,
  authHeader: string,
): Promise<string> {
  if (!paths.length) return ''

  const results: string[] = []
  // Fetch up to 10 files to avoid token overflow
  const limitedPaths = paths.slice(0, 10)

  for (const path of limitedPaths) {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/github-agent`, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_file', owner: 'JibreelMuhammad', repo: 'property-web3-portal', path }),
      })
      if (!res.ok) continue
      const data = await res.json()
      if (data.content) {
        // Truncate very large files
        const content = data.content.length > 8000
          ? data.content.substring(0, 8000) + '\n... [truncated]'
          : data.content
        results.push(`### ${path}\n\`\`\`\n${content}\n\`\`\``)
      }
    } catch { /* skip failed files */ }
  }

  return results.length
    ? `\n\n## Selected File Contents\nThe admin has selected these files for your review:\n\n${results.join('\n\n')}`
    : ''
}

function inferRelevantFiles(topic: string, treeContent: string): string[] {
  const paths: string[] = []
  const topicLower = topic.toLowerCase()

  // Extract file paths from tree
  const allPaths = treeContent.split('\n')
    .map(line => line.replace(/^- /, '').replace(/ \(\d+b\)$/, '').trim())
    .filter(p => p.length > 0)

  // Match files mentioned in the topic
  for (const p of allPaths) {
    const fileName = p.split('/').pop()?.toLowerCase() || ''
    const pathLower = p.toLowerCase()
    if (topicLower.includes(fileName.replace(/\.(tsx?|jsx?|ts|js)$/, ''))
        || topicLower.includes(pathLower)) {
      paths.push(p)
    }
  }

  // Keyword-based matching
  const keywords: Record<string, string[]> = {
    'auth': ['src/hooks/useAuth.ts', 'src/pages/Auth.tsx', 'src/hooks/useTeamAccess.ts'],
    'wallet': ['src/contexts/ActiveWalletContext.tsx', 'src/components/WalletConnectModal.tsx'],
    'mint': ['src/components/mint/MintWizard.tsx', 'src/pages/Mint.tsx'],
    'kyc': ['src/pages/Kyc.tsx', 'src/hooks/useKycStatus.ts'],
    'portfolio': ['src/pages/Portfolio.tsx', 'src/hooks/usePortfolio.ts'],
    'property': ['src/pages/PropertyDetail.tsx', 'src/hooks/useProperties.ts'],
    'ai panel': ['src/components/ai-panel/AIPanel.tsx', 'src/hooks/useDebateSession.ts'],
    'debate': ['src/components/ai-panel/AIPanel.tsx', 'src/hooks/useDebateSession.ts'],
    'tokenize': ['src/pages/Tokenize.tsx', 'src/hooks/useTokenizeForm.ts'],
    'xrpl': ['supabase/functions/xrpl-build-mint/index.ts'],
    'navigation': ['src/components/Navigation.tsx', 'src/App.tsx'],
  }

  for (const [keyword, filePaths] of Object.entries(keywords)) {
    if (topicLower.includes(keyword)) {
      for (const fp of filePaths) {
        if (allPaths.includes(fp) && !paths.includes(fp)) paths.push(fp)
      }
    }
  }

  return paths.slice(0, 5) // Limit to 5 auto-inferred files
}

async function recallAgentMemory(
  supabaseAdmin: ReturnType<typeof createClient>,
  speaker: Speaker,
): Promise<string> {
  // Fetch shared memories
  const { data: shared } = await supabaseAdmin
    .from('agent_memory')
    .select('key, content')
    .eq('category', 'shared')
    .neq('key', 'repo_file_tree')
    .order('updated_at', { ascending: false })
    .limit(10)

  // Fetch per-agent memories
  const { data: agentSpecific } = await supabaseAdmin
    .from('agent_memory')
    .select('key, content')
    .eq('category', `agent_${speaker}`)
    .order('updated_at', { ascending: false })
    .limit(5)

  const parts: string[] = []

  if (shared?.length) {
    parts.push('## Shared Knowledge (from past sessions)\n' +
      shared.map(m => `**${m.key}**: ${m.content}`).join('\n'))
  }

  if (agentSpecific?.length) {
    parts.push(`## Your Past Notes (${speaker})\n` +
      agentSpecific.map(m => `**${m.key}**: ${m.content}`).join('\n'))
  }

  return parts.length ? '\n\n' + parts.join('\n\n') : ''
}

async function storeDebateConclusions(
  supabaseAdmin: ReturnType<typeof createClient>,
  topic: string,
  replies: Record<string, string>,
) {
  const timestamp = new Date().toISOString().slice(0, 10)
  const summaryKey = `debate_${timestamp}_${topic.slice(0, 40).replace(/\s+/g, '_')}`

  // Store shared summary
  const combined = Object.entries(replies)
    .map(([speaker, text]) => `[${speaker}]: ${text.slice(0, 500)}`)
    .join('\n\n')

  await supabaseAdmin.from('agent_memory').upsert(
    {
      user_id: '00000000-0000-0000-0000-000000000000',
      category: 'shared',
      key: summaryKey,
      content: `Topic: ${topic}\n\n${combined}`,
      metadata: { type: 'debate_conclusion', topic },
    },
    { onConflict: 'user_id,key' }
  ).then(() => console.log('Stored shared debate conclusion'))

  // Store per-agent notes
  for (const [speaker, text] of Object.entries(replies)) {
    if (!text) continue
    await supabaseAdmin.from('agent_memory').upsert(
      {
        user_id: '00000000-0000-0000-0000-000000000000',
        category: `agent_${speaker}`,
        key: summaryKey,
        content: text.slice(0, 2000),
        metadata: { type: 'own_conclusion', topic },
      },
      { onConflict: 'user_id,key' }
    )
  }
}

// ─── Debate logic ─────────────────────────────────────────────

function modeInstruction(mode: Mode, other: string): string {
  switch (mode) {
    case 'debate':
      return `You are debating ${other}. Present your strongest reasoning. Challenge weak arguments directly. Aim for clarity, not consensus.`
    case 'collaborate':
      return `You are collaborating with ${other} to give the user the best possible answer. Build on what they said, fill in gaps, and work toward a concrete recommendation.\n\nIMPORTANT: When proposing next steps or action items, format them as a numbered list with this exact structure:\n1. **Title** - Description of the task\n2. **Title** - Description of the task\nThis format allows the platform to parse your suggestions into actionable GitHub issues.`
    case 'compare':
      return `Give your independent analysis. Do not react to ${other}'s response — provide your own assessment so the user can compare perspectives.`
  }
}

function buildSystem(speaker: 'claude' | 'gpt' | 'gemini', mode: Mode, codebaseContext: string, memoryContext: string): string {
  const others: Record<string, string> = {
    claude: 'ChatGPT (GPT-4o) and Gemini (gemini-3-flash-preview)',
    gpt: 'Claude (claude-sonnet-4-6) and Gemini (gemini-3-flash-preview)',
    gemini: 'Claude (claude-sonnet-4-6) and ChatGPT (GPT-4o)',
  }
  return `${codebaseContext}${memoryContext}\n\nBe direct, substantive, and intellectually honest. Reference specific file paths when discussing code.\n\n${modeInstruction(mode, others[speaker])}`
}

type Msg = { role: 'user' | 'assistant'; content: string }

function buildSpeakerHistory(self: Speaker, topic: string, history: HistoryItem[], mode: Mode): Msg[] {
  const msgs: Msg[] = [{ role: 'user', content: topic }]
  for (const item of history) {
    if (item.speaker === self) {
      msgs.push({ role: 'assistant', content: item.text })
    } else if (item.speaker === 'user') {
      msgs.push({ role: 'user', content: `[Human facilitator]: ${item.text}` })
    } else if (mode !== 'compare') {
      msgs.push({ role: 'user', content: item.text })
    }
  }
  return msgs
}

// ─── Main handler ─────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

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

  // --- Build context (cached tree + on-demand files + memory) ---
  const { topic, mode, history = [], round = 1, turnOffset = 0, selectedFiles = [], transcript_summary, conversation_messages, thread_id }: RequestBody = await req.json()
  if (!topic?.trim()) {
    return new Response('Bad Request: topic required', { status: 400, headers: corsHeaders })
  }

  // ─── Conclude mode: structured task extraction ───────────────
  if (mode === 'conclude') {
    const lovableKey = Deno.env.get('LOVABLE_API_KEY')
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const concludeSystemPrompt = `You are a technical project manager for an RWA tokenization platform built on XRPL.
Given the following multi-agent conversation and user input, extract 3 to 8 concrete actionable tasks.
Call the extract_action_items function with your results.

Rules:
- Each task must be implementation-ready
- Use specific files, components, functions, routes, or systems where possible
- Include both user requests and agent conclusions
- Priority must be HIGH, MEDIUM, or LOW
- Description should be detailed enough for a developer to start working`

    // Build the user content: prefer conversation_messages over transcript_summary
    let userContent = `## Debate Topic\n${topic}\n\n`
    if (conversation_messages && conversation_messages.length > 0) {
      userContent += `## Full Conversation\n`
      for (const msg of conversation_messages) {
        const label = msg.speaker ? `[${msg.speaker.toUpperCase()}]` : `[${msg.role.toUpperCase()}]`
        userContent += `${label}: ${msg.content}\n\n`
      }
    } else if (transcript_summary) {
      userContent += `## Full Transcript\n${transcript_summary}`
    } else {
      userContent += `## Transcript\nNo transcript provided.`
    }
        tools: [{
          type: 'function',
          function: {
            name: 'extract_action_items',
            description: 'Extract structured action items from the debate transcript.',
            parameters: {
              type: 'object',
              properties: {
                action_items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string', description: 'Short actionable title' },
                      priority: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
                      description: { type: 'string', description: 'Detailed description of the task' },
                      files: { type: 'array', items: { type: 'string' }, description: 'Relevant file paths' },
                      expected_outcome: { type: 'string', description: 'What completing this task achieves' },
                    },
                    required: ['title', 'priority', 'description', 'files', 'expected_outcome'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['action_items'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'extract_action_items' } },
      }),
    })

    if (!concludeRes.ok) {
      const errText = await concludeRes.text()
      console.error('Conclude AI call failed:', concludeRes.status, errText)
      return new Response(JSON.stringify({ error: `AI call failed (${concludeRes.status})` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const concludeData = await concludeRes.json()
    let actionItems: unknown[] = []

    // Extract from tool_calls response
    const toolCall = concludeData.choices?.[0]?.message?.tool_calls?.[0]
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments)
        actionItems = parsed.action_items || []
      } catch (e) {
        console.error('Failed to parse tool call arguments:', e)
      }
    }

    const encoder = new TextEncoder()
    const concludeStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'conclude_result', action_items: actionItems }) + '\n'))
        controller.close()
      },
    })

    return new Response(concludeStream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  // Only fetch context on round 1 to avoid redundant calls
  let codebaseContext = FALLBACK_CONTEXT
  let fileContents = ''

  const treeContent = await getCachedTree(supabaseAdmin, supabaseUrl, authHeader)
  if (treeContent) {
    codebaseContext = `${FALLBACK_CONTEXT}\n\n## Repository File Tree\n${treeContent}`
  }

  if (round === 1) {
    // Combine admin-selected files + auto-inferred files from topic
    const inferredFiles = treeContent ? inferRelevantFiles(topic, treeContent) : []
    const allFiles = [...new Set([...selectedFiles, ...inferredFiles])]

    if (allFiles.length > 0) {
      console.log('Fetching file contents for:', allFiles)
      fileContents = await fetchFileContents(allFiles, supabaseUrl, authHeader)
      codebaseContext += fileContents
    }
  }

  // Recall agent memories
  const [claudeMemory, gptMemory, geminiMemory] = await Promise.all([
    recallAgentMemory(supabaseAdmin, 'claude'),
    recallAgentMemory(supabaseAdmin, 'gpt'),
    recallAgentMemory(supabaseAdmin, 'gemini'),
  ])

  const claudeKey = Deno.env.get('ANTHROPIC_API_KEY')!
  const openaiKey = Deno.env.get('OPENAI_API_KEY')!
  const lovableKey = Deno.env.get('LOVABLE_API_KEY')!

  const claudeMessages = buildSpeakerHistory('claude', topic, history, mode)
  const gptMessages = buildSpeakerHistory('gpt', topic, history, mode)
  const geminiMessages = buildSpeakerHistory('gemini', topic, history, mode)

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
            system: buildSystem('claude', mode, codebaseContext, claudeMemory),
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

        const messages = [
          { role: 'system', content: buildSystem('gpt', mode, codebaseContext, gptMemory) },
          ...gptMessages,
          ...(mode !== 'compare' ? [{ role: 'user', content: claudeReply }] : []),
        ]

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model: 'gpt-4o', stream: true, messages }),
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

      async function streamGemini(claudeReply: string, gptReply: string): Promise<string> {
        write({ type: 'turn_start', speaker: 'gemini', turn: 3 })

        const messages = [
          { role: 'system', content: buildSystem('gemini', mode, codebaseContext, geminiMemory) },
          ...geminiMessages,
          ...(mode !== 'compare' ? [
            { role: 'user', content: `[Claude's response]:\n${claudeReply}` },
            { role: 'user', content: `[GPT's response]:\n${gptReply}` },
          ] : []),
        ]

        const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model: 'google/gemini-3-flash-preview', stream: true, messages }),
        })

        if (!res.ok) {
          const msg = await res.text()
          write({ type: 'error', message: `Gemini error (${res.status}): ${msg}` })
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
                write({ type: 'chunk', speaker: 'gemini', text })
              }
            } catch { /* skip */ }
          }
        }

        write({ type: 'turn_end', speaker: 'gemini', turn: 3, full_text: fullText })
        return fullText
      }

      try {
        const claudeReply = await streamClaude()
        if (!claudeReply) { controller.close(); return }

        const gptReply = await streamGPT(claudeReply)
        const geminiReply = await streamGemini(claudeReply, gptReply)

        // Store conclusions after last round (fire-and-forget)
        storeDebateConclusions(supabaseAdmin, topic, {
          claude: claudeReply,
          gpt: gptReply,
          gemini: geminiReply,
        }).catch(e => console.warn('Failed to store conclusions:', e))

        write({
          type: 'done',
          round,
          turn_offset: turnOffset,
          total_turns: 3,
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