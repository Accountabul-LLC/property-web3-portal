import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ALLOWED_ORIGIN') ?? 'https://accountabul.lovable.app',
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

function toHex(text: string): string {
  return Array.from(new TextEncoder().encode(text.slice(0, 64)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
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

    const body = await req.json()
    const { credential_key, wallet_address } = body as { credential_key: string; wallet_address: string }

    if (!credential_key || !wallet_address) {
      return new Response(JSON.stringify({ error: 'credential_key and wallet_address are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 1. Verify credential_class = 'A' ──────────────────────────────────
    const { data: catalog, error: catalogError } = await serviceClient
      .from('credential_catalog' as any)
      .select('credential_key, credential_name, credential_class, is_active, allowed_account_types, maps_to_xrpl_code')
      .eq('credential_key', credential_key)
      .single()

    if (catalogError || !catalog) {
      return new Response(JSON.stringify({ error: 'Credential type not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const cat = catalog as any
    if (!cat.is_active) {
      return new Response(JSON.stringify({ error: 'This credential type is not currently available' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (cat.credential_class !== 'A') {
      return new Response(JSON.stringify({ error: 'auto-issue is only available for Type A credentials' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 2. Check no existing non-terminal application ─────────────────────
    const { data: existingApp } = await serviceClient
      .from('credential_applications' as any)
      .select('id, status')
      .eq('user_id', user.id)
      .eq('credential_key', credential_key)
      .eq('wallet_address', wallet_address)
      .not('status', 'in', '("rejected","expired","revoked")')
      .maybeSingle()

    if (existingApp) {
      return new Response(
        JSON.stringify({
          error: 'You already have an active application for this credential',
          current_status: (existingApp as any).status,
          application_id: (existingApp as any).id,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 3. Re-derive live_facts server-side (never trust client cache) ────
    const [profileRes, kycRes, walletRes, walletRegRes, kycDocsRes, reqsRes] = await Promise.all([
      serviceClient.from('profiles' as any).select('account_type').eq('id', user.id).single(),
      serviceClient.rpc('get_kyc_status', { p_user_id: user.id }),
      serviceClient
        .from('user_wallets' as any)
        .select('id, wallet_address, network, status, signature_verified_at')
        .eq('user_id', user.id)
        .eq('wallet_address', wallet_address)
        .maybeSingle(),
      serviceClient
        .from('wallet_registrations' as any)
        .select('id, registration_status')
        .eq('user_id', user.id)
        .eq('wallet_address', wallet_address)
        .maybeSingle(),
      (async () => {
        const { data: kycCase } = await serviceClient
          .from('kyc_cases' as any)
          .select('id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (!kycCase) return { data: [] }
        return serviceClient
          .from('kyc_documents' as any)
          .select('id, doc_type, status, metadata')
          .eq('kyc_case_id', (kycCase as any).id)
          .eq('status', 'accepted')
      })(),
      serviceClient
        .from('credential_requirements' as any)
        .select('requirement_key, artifact_type, artifact_subtype, check_mode, display_label, display_hint, is_blocking, sort_order')
        .eq('credential_key', credential_key)
        .order('sort_order'),
    ])

    const profile = profileRes.data as any
    const kycStatus = kycRes.data as string | null
    const wallet = walletRes.data as any
    const walletReg = walletRegRes.data as any
    const kycDocs = (kycDocsRes as any).data ?? []
    const requirements = (reqsRes.data ?? []) as any[]

    const accountType: string = profile?.account_type ?? 'individual'
    const allowedAccountTypes: string[] = cat.allowed_account_types ?? ['individual', 'business']

    if (!allowedAccountTypes.includes(accountType)) {
      return new Response(JSON.stringify({ error: 'This credential is not available for your account type' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build live_facts
    const liveFacts = new Set<string>()
    if (accountType === 'individual') liveFacts.add('account_type_individual')
    if (accountType === 'business') liveFacts.add('account_type_business')
    if (kycStatus === 'approved') liveFacts.add('kyc_approved')
    if (wallet && walletReg?.registration_status === 'approved') liveFacts.add('wallet_registered')
    if (wallet?.signature_verified_at) liveFacts.add('wallet_ownership_proven')

    for (const doc of kycDocs) {
      const docType: string = doc.doc_type ?? ''
      const artifactSubtype: string | null = doc.metadata?.artifact_subtype ?? null
      if (docType === 'government_id' || docType === 'gov_id') liveFacts.add('gov_id_uploaded')
      if (docType === 'proof_of_address') liveFacts.add('proof_of_address_uploaded')
      if (docType === 'business_registration' || artifactSubtype === 'business_reg') {
        liveFacts.add('business_registration_doc::business_reg')
      }
      if (docType === 'professional_license' || docType === 'license') {
        if (artifactSubtype === 'appraiser_license') liveFacts.add('professional_license_doc::appraiser_license')
        else if (artifactSubtype === 'notary_license') liveFacts.add('professional_license_doc::notary_license')
        else if (!artifactSubtype) liveFacts.add('professional_license_doc')
      }
    }

    // Evaluate all auto requirements
    let allAutoMet = true
    const blockingReasons: string[] = []

    for (const req of requirements) {
      if (req.check_mode !== 'auto') continue
      const factKey = req.artifact_subtype
        ? `${req.artifact_type}::${req.artifact_subtype}`
        : req.artifact_type
      const met = liveFacts.has(factKey)
      if (!met) {
        allAutoMet = false
        blockingReasons.push(req.display_hint ?? req.display_label)
      }
    }

    if (!allAutoMet) {
      return new Response(
        JSON.stringify({ error: 'Not all eligibility requirements are met', blocking_reasons: blockingReasons }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 4. Fetch wallet row ────────────────────────────────────────────────
    if (!wallet) {
      return new Response(JSON.stringify({ error: 'Wallet not found or does not belong to your account' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const network: string = wallet.network ?? 'testnet'
    const nodes = network === 'testnet' ? TESTNET_NODES : MAINNET_NODES

    // ── 5. Fetch issuer wallet ─────────────────────────────────────────────
    const { data: issuer, error: issuerError } = await serviceClient
      .from('xrpl_issuer_wallets' as any)
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

    const issuerRecord = issuer as any

    // ── 6. Build credential_type_hex ──────────────────────────────────────
    const credentialTypeText: string = cat.maps_to_xrpl_code ?? credential_key
    const credentialTypeHex = toHex(credentialTypeText)

    const now = new Date().toISOString()

    // ── 7. INSERT credential_application at status='applied' ──────────────
    const { data: newApp, error: appInsertError } = await serviceClient
      .from('credential_applications' as any)
      .insert({
        user_id: user.id,
        wallet_address,
        credential_key,
        status: 'applied',
        applied_at: now,
      })
      .select('id')
      .single()

    if (appInsertError || !newApp) {
      return new Response(
        JSON.stringify({ error: 'Failed to create application', details: appInsertError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const applicationId: string = (newApp as any).id

    // ── 8. UPDATE to status='approved' immediately (no admin step for Type A) ──
    await serviceClient
      .from('credential_applications' as any)
      .update({ status: 'approved', reviewed_by: user.id, reviewed_at: now, updated_at: now })
      .eq('id', applicationId)

    // ── 9. INSERT wallet_credentials ──────────────────────────────────────
    const { data: walletCred, error: credInsertError } = await serviceClient
      .from('wallet_credentials' as any)
      .insert({
        user_id: user.id,
        wallet_id: wallet.id,
        issuer_address: issuerRecord.issuer_address,
        credential_type: credential_key,
        credential_type_hex: credentialTypeHex,
        ledger_status: 'pending_issuance',
      })
      .select('id')
      .single()

    if (credInsertError || !walletCred) {
      return new Response(
        JSON.stringify({ error: 'Failed to create wallet credential record', details: credInsertError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const walletCredentialId: string = (walletCred as any).id

    // ── 10. UPDATE application to issued_pending_acceptance ───────────────
    const issuedAt = new Date()
    const expiresAt = new Date(issuedAt.getTime() + 48 * 60 * 60 * 1000)

    await serviceClient
      .from('credential_applications' as any)
      .update({
        status: 'issued_pending_acceptance',
        issued_at: issuedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        wallet_credential_id: walletCredentialId,
        updated_at: now,
      })
      .eq('id', applicationId)

    // ── 11. Submit CredentialCreate to XRPL ───────────────────────────────
    let ledgerStatus = 'pending_issuance'
    let txHash: string | undefined
    let xamanUuid: string | undefined
    let qrCode: string | undefined
    let message = ''

    if (network === 'testnet' && issuerRecord.secret_env_key) {
      const issuerSecret = Deno.env.get(issuerRecord.secret_env_key)
      if (issuerSecret) {
        try {
          // Get server info for LastLedgerSequence
          const serverInfo = await xrplRequest(nodes, 'server_info', {})
          const serverState = serverInfo.info as Record<string, unknown> | undefined
          const validatedLedger = serverState?.validated_ledger as Record<string, unknown> | undefined
          const currentLedger = (validatedLedger?.seq as number) ?? 0
          const lastLedgerSequence = currentLedger + 20

          // Get account sequence
          const accountInfo = await xrplRequest(nodes, 'account_info', {
            account: issuerRecord.issuer_address,
            ledger_index: 'current',
          })
          const accountData = accountInfo.account_data as Record<string, unknown> | undefined
          const sequence = accountData?.Sequence as number

          const credentialTx = {
            TransactionType: 'CredentialCreate',
            Account: issuerRecord.issuer_address,
            Subject: wallet_address,
            CredentialType: credentialTypeHex,
            Sequence: sequence,
            LastLedgerSequence: lastLedgerSequence,
            Fee: '12',
          }

          const signResult = await xrplRequest(nodes, 'sign', {
            tx_json: credentialTx,
            secret: issuerSecret,
          })

          const txBlob = (signResult.tx_blob as string) ?? ''
          const submitResult = await xrplRequest(nodes, 'submit', { tx_blob: txBlob })
          const engineResult = submitResult.engine_result as string

          if (engineResult?.startsWith('tes') || engineResult === 'terQUEUED') {
            txHash = (signResult.tx_json as Record<string, unknown>)?.hash as string | undefined
            ledgerStatus = 'issued'
            await serviceClient
              .from('wallet_credentials' as any)
              .update({
                ledger_status: 'issued',
                tx_hash_issued: txHash ?? null,
                issued_at: issuedAt.toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', walletCredentialId)
            message = 'Credential issued on testnet. You can now accept it in your wallet.'
          } else {
            message = `XRPL submission returned: ${engineResult}. Manual issuance may be required.`
          }
        } catch (xrplErr) {
          const xrplMsg = xrplErr instanceof Error ? xrplErr.message : String(xrplErr)
          message = `XRPL submission failed: ${xrplMsg}. Credential record created; manual issuance required.`
        }
      } else {
        message = `Issuer secret not configured (${issuerRecord.secret_env_key}). Credential record created; manual issuance required.`
      }
    } else {
      // Mainnet or no seed: create Xaman payload
      const xamanApiKey = Deno.env.get('XAMAN_API_KEY')
      const xamanApiSecret = Deno.env.get('XAMAN_API_SECRET')

      if (xamanApiKey && xamanApiSecret) {
        try {
          const xamanPayload = {
            txjson: {
              TransactionType: 'CredentialCreate',
              Account: issuerRecord.issuer_address,
              Subject: wallet_address,
              CredentialType: credentialTypeHex,
            },
            options: {
              submit: true,
              return_url: { web: `${Deno.env.get('SITE_URL') ?? ''}/credentials` },
            },
            custom_meta: {
              instruction: `Issue ${cat.credential_name} credential to ${wallet_address}`,
              identifier: `auto-issue-${applicationId}`,
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

          if (xamanRes.ok) {
            const xamanData = await xamanRes.json() as Record<string, unknown>
            xamanUuid = (xamanData.uuid as string) ?? ''
            const refs = xamanData.refs as Record<string, unknown> | undefined
            qrCode = (refs?.qr_png as string) ?? ''
            await serviceClient
              .from('wallet_credentials' as any)
              .update({ xaman_uuid: xamanUuid, updated_at: new Date().toISOString() })
              .eq('id', walletCredentialId)
            message = 'Scan QR code in Xaman to sign and submit the credential issuance.'
          } else {
            message = 'Failed to create Xaman payload. Credential record created; manual issuance required.'
          }
        } catch {
          message = 'Xaman request failed. Credential record created; manual issuance required.'
        }
      } else {
        message = 'Xaman credentials not configured. Credential record created; manual issuance required.'
      }
    }

    // ── 12. UPSERT credential_eligibility to ready_to_accept ─────────────
    await serviceClient
      .from('credential_eligibility' as any)
      .upsert(
        {
          user_id: user.id,
          wallet_address,
          credential_key,
          ui_section: 'ready_to_accept',
          requirements_snapshot: [],
          all_auto_met: true,
          has_manual_requirements: false,
          all_blocking_met: true,
          blocking_reasons: [],
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,credential_key,wallet_address', ignoreDuplicates: false }
      )

    return new Response(
      JSON.stringify({
        application_id: applicationId,
        wallet_credential_id: walletCredentialId,
        ledger_status: ledgerStatus,
        ...(txHash ? { tx_hash: txHash } : {}),
        ...(xamanUuid ? { xaman_uuid: xamanUuid } : {}),
        ...(qrCode ? { qr_code: qrCode } : {}),
        message,
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
