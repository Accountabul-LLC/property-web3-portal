import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const TESTNET_NODES = ['https://s.altnet.rippletest.net:51234', 'https://testnet.xrpl-labs.com']
const MAINNET_NODES = ['https://xrplcluster.com', 'https://s1.ripple.com:51234']
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function xrplRequest(
  nodes: string[],
  method: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const node = nodes[attempt % nodes.length]
    try {
      const res = await fetch(node, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, params: [params] }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${node}`)
      const data = await res.json() as Record<string, unknown>
      const result = data.result as Record<string, unknown> | undefined
      if (result && result.status === 'error') {
        throw new Error((result.error_message as string) || (result.error as string) || 'XRPL error')
      }
      return result ?? data
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS)
    }
  }

  throw lastError ?? new Error('XRPL request failed after retries')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const anonClient = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    // Check admin or compliance_officer role
    const { data: isAdmin } = await serviceClient.rpc('has_role', { _user_id: user.id, _role: 'admin' })
    const { data: isCompliance } = await serviceClient.rpc('has_role', { _user_id: user.id, _role: 'compliance_officer' })
    if (!isAdmin && !isCompliance) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { application_id } = body as { application_id: string }

    if (!application_id) {
      return new Response(JSON.stringify({ error: 'application_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch application with catalog info
    const { data: app, error: appError } = await serviceClient
      .from('credential_applications')
      .select(`
        id, user_id, wallet_address, credential_key, status, wallet_credential_id,
        credential_catalog ( credential_name, maps_to_xrpl_code )
      `)
      .eq('id', application_id)
      .single()

    if (appError || !app) {
      return new Response(JSON.stringify({ error: 'Application not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (app.status !== 'issued_pending_acceptance') {
      return new Response(
        JSON.stringify({ error: `Application must be in issued_pending_acceptance status. Current: ${app.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch wallet info (network)
    const { data: wallet, error: walletError } = await serviceClient
      .from('user_wallets')
      .select('id, wallet_address, network, status')
      .eq('user_id', app.user_id)
      .eq('wallet_address', app.wallet_address)
      .single()

    if (walletError || !wallet) {
      return new Response(JSON.stringify({ error: 'Wallet not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch linked wallet_credentials row
    if (!app.wallet_credential_id) {
      return new Response(JSON.stringify({ error: 'No wallet credential record linked to this application' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: walletCred, error: credFetchError } = await serviceClient
      .from('wallet_credentials')
      .select('id, ledger_status, credential_type')
      .eq('id', app.wallet_credential_id)
      .single()

    if (credFetchError || !walletCred) {
      return new Response(JSON.stringify({ error: 'Wallet credential record not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const network = wallet.network ?? 'testnet'

    // Fetch issuer wallet for this network
    const { data: issuer, error: issuerError } = await serviceClient
      .from('xrpl_issuer_wallets')
      .select('id, issuer_address, secret_env_key, network, status')
      .eq('network', network)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (issuerError || !issuer) {
      return new Response(JSON.stringify({ error: `No active issuer wallet found for network: ${network}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const now = new Date().toISOString()

    // Testnet auto-sign path
    if (network === 'testnet' && issuer.secret_env_key) {
      const issuerSecret = Deno.env.get(issuer.secret_env_key)
      if (!issuerSecret) {
        return new Response(
          JSON.stringify({ error: `Issuer secret env var ${issuer.secret_env_key} not configured` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const nodes = TESTNET_NODES

      // Get current ledger for LastLedgerSequence
      const serverInfo = await xrplRequest(nodes, 'server_info', {})
      const serverState = serverInfo.info as Record<string, unknown> | undefined
      const validatedLedger = serverState?.validated_ledger as Record<string, unknown> | undefined
      const currentLedger = (validatedLedger?.seq as number) ?? 0
      const lastLedgerSequence = currentLedger + 20

      // Get account sequence
      const accountInfo = await xrplRequest(nodes, 'account_info', {
        account: issuer.issuer_address,
        ledger_index: 'current',
      })
      const accountData = accountInfo.account_data as Record<string, unknown> | undefined
      const sequence = accountData?.Sequence as number

      // Build credential type hex (use catalog xrpl code or key as hex)
      const catalogEntry = app.credential_catalog as { credential_name: string; maps_to_xrpl_code: string | null } | null
      const credentialTypeText = catalogEntry?.maps_to_xrpl_code ?? app.credential_key
      const credentialTypeHex = Array.from(
        new TextEncoder().encode(credentialTypeText.slice(0, 64))
      )
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()

      const credentialTx = {
        TransactionType: 'CredentialCreate',
        Account: issuer.issuer_address,
        Subject: app.wallet_address,
        CredentialType: credentialTypeHex,
        Sequence: sequence,
        LastLedgerSequence: lastLedgerSequence,
        Fee: '12',
      }

      // Sign and submit
      const signResult = await xrplRequest(nodes, 'sign', {
        tx_json: credentialTx,
        secret: issuerSecret,
      })

      const txBlob = (signResult.tx_blob as string) ?? ''
      const submitResult = await xrplRequest(nodes, 'submit', { tx_blob: txBlob })
      const engineResult = submitResult.engine_result as string

      if (!engineResult?.startsWith('tes') && engineResult !== 'terQUEUED') {
        return new Response(
          JSON.stringify({ error: `XRPL submission failed: ${engineResult}`, details: submitResult }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const txHash = (signResult.tx_json as Record<string, unknown>)?.hash as string | undefined

      // Update wallet_credentials to issued
      await serviceClient
        .from('wallet_credentials')
        .update({ ledger_status: 'issued', updated_at: now })
        .eq('id', walletCred.id)

      return new Response(
        JSON.stringify({
          ledger_status: 'issued',
          tx_hash: txHash,
          message: 'Credential issued on testnet. User can now accept it.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Mainnet path (or testnet without secret): create Xaman payload
    const xamanApiKey = Deno.env.get('XAMAN_API_KEY')
    const xamanApiSecret = Deno.env.get('XAMAN_API_SECRET')

    if (!xamanApiKey || !xamanApiSecret) {
      return new Response(
        JSON.stringify({ error: 'Xaman credentials not configured for mainnet signing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const catalogEntry = app.credential_catalog as { credential_name: string; maps_to_xrpl_code: string | null } | null
    const credentialTypeText = catalogEntry?.maps_to_xrpl_code ?? app.credential_key
    const credentialTypeHex = Array.from(
      new TextEncoder().encode(credentialTypeText.slice(0, 64))
    )
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()

    const xamanPayload = {
      txjson: {
        TransactionType: 'CredentialCreate',
        Account: issuer.issuer_address,
        Subject: app.wallet_address,
        CredentialType: credentialTypeHex,
      },
      options: {
        submit: true,
        return_url: { web: `${Deno.env.get('SITE_URL') ?? ''}/admin/credentials` },
      },
      custom_meta: {
        instruction: `Issue ${catalogEntry?.credential_name ?? app.credential_key} credential to ${app.wallet_address}`,
        identifier: `issue-cred-${application_id}`,
      },
    }

    const xamanRes = await fetch('https://xumm.app/api/v1/platform/payload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': xamanApiKey,
        'x-api-secret': xamanApiSecret,
      },
      body: JSON.stringify(xamanPayload),
    })

    if (!xamanRes.ok) {
      const errText = await xamanRes.text()
      return new Response(
        JSON.stringify({ error: 'Failed to create Xaman payload', details: errText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const xamanData = await xamanRes.json() as Record<string, unknown>
    const uuid = (xamanData.uuid as string) ?? ''
    const refs = xamanData.refs as Record<string, unknown> | undefined
    const qrCode = (refs?.qr_png as string) ?? ''

    // Store xaman_uuid on wallet_credentials if column exists
    await serviceClient
      .from('wallet_credentials')
      .update({ xaman_uuid: uuid, updated_at: now })
      .eq('id', walletCred.id)

    return new Response(
      JSON.stringify({
        ledger_status: 'pending_issuance',
        xaman_uuid: uuid,
        qr_code: qrCode,
        message: 'Scan QR code in Xaman wallet to sign and submit the credential issuance.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
