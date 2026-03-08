/**
 * check-credential-payload
 *
 * Polls Xaman for the status of a CredentialCreate signing payload.
 * Once signed, commits:
 *   1. wallet_registrations → approved
 *   2. wallet_credentials → issued
 *   3. wallet_permission_assignments → TRADE_GLOBAL
 *
 * If cancelled/expired, reverts registration to 'pending'.
 *
 * Body: { uuid: string, registration_id: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const xamanApiKey = Deno.env.get('XAMAN_API_KEY')!
    const xamanApiSecret = Deno.env.get('XAMAN_API_SECRET')!

    // ── Auth ─────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401,
      })
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user } } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401,
      })
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    const { uuid, registration_id } = await req.json()
    if (!uuid || !registration_id) {
      return new Response(JSON.stringify({ error: 'Missing uuid or registration_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    // ── Check Xaman payload status ───────────────────────────
    const xamanRes = await fetch(`https://xaman.app/api/v1/platform/payload/${uuid}`, {
      headers: { 'X-API-Key': xamanApiKey, 'X-API-Secret': xamanApiSecret },
    })
    const xamanText = await xamanRes.text()
    if (!xamanRes.ok) throw new Error(`Xaman API error: ${xamanRes.status}`)
    const xamanData = JSON.parse(xamanText)

    const signed = xamanData.meta?.signed === true
    const cancelled = xamanData.meta?.cancelled === true
    const expired = xamanData.meta?.expired === true
    const txHash = xamanData.response?.txid || xamanData.response?.dispatched_result || null
    const engineResult = xamanData.response?.dispatched_result || null

    console.log(`Credential payload ${uuid}: signed=${signed} cancelled=${cancelled} expired=${expired} txHash=${txHash}`)

    if (!signed && !cancelled && !expired) {
      return new Response(JSON.stringify({
        status: 'pending',
        signed: false,
        cancelled: false,
        expired: false,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      })
    }

    if (cancelled || expired) {
      // Revert registration back to pending
      await serviceClient.from('wallet_registrations').update({
        registration_status: 'pending',
        updated_at: new Date().toISOString(),
      }).eq('id', registration_id)

      await serviceClient.from('xaman_payloads').update({
        status: cancelled ? 'cancelled' : 'expired',
      }).eq('uuid', uuid)

      return new Response(JSON.stringify({
        status: cancelled ? 'cancelled' : 'expired',
        signed: false,
        cancelled,
        expired,
        message: 'Signing was cancelled or expired. Registration reverted to pending.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      })
    }

    // ── SIGNED — Read metadata from our DB (stored by wallet-approve) ──
    const { data: payloadRow } = await serviceClient
      .from('xaman_payloads')
      .select('metadata')
      .eq('uuid', uuid)
      .maybeSingle()

    const meta: any = payloadRow?.metadata || {}

    const now = new Date().toISOString()
    const walletId = meta.wallet_id
    const issuerWalletId = meta.issuer_wallet_id
    const issuerAddress = meta.issuer_address || xamanData.response?.account
    const credentialType = meta.credential_type || 'ACCOUNTABUL_TRADE_APPROVED'
    const credentialTypeHex = meta.credential_type_hex
    const adminUserId = meta.admin_user_id || user.id
    const regNotes = meta.notes

    // 1. Approve the registration
    await serviceClient.from('wallet_registrations').update({
      registration_status: 'approved',
      reviewer_id: adminUserId,
      reviewed_at: now,
      notes: regNotes,
      updated_at: now,
    }).eq('id', registration_id)

    // 2. Create wallet_credentials row (already issued on-chain)
    const { data: credRow, error: credErr } = await serviceClient
      .from('wallet_credentials')
      .insert({
        wallet_id: walletId,
        wallet_registration_id: registration_id,
        issuer_wallet_id: issuerWalletId,
        issuer_address: issuerAddress,
        credential_type: credentialType,
        credential_type_hex: credentialTypeHex,
        ledger_status: 'issued',
        issued_at: now,
        tx_hash: txHash,
      })
      .select('id, ledger_status')
      .single()
    if (credErr) {
      console.error('Failed to insert credential:', credErr)
      throw credErr
    }

    // 3. Assign TRADE_GLOBAL permission
    await serviceClient.from('wallet_permission_assignments').upsert({
      wallet_id: walletId,
      permission_profile_code: 'TRADE_GLOBAL',
      status: 'active',
      granted_by: adminUserId,
      starts_at: now,
      updated_at: now,
    }, { onConflict: 'wallet_id,permission_profile_code' })

    // 4. Update xaman_payloads
    await serviceClient.from('xaman_payloads').update({
      status: 'signed',
      wallet_address: issuerAddress,
      signed_at: now,
    }).eq('uuid', uuid)

    // 5. Update issuer timestamp
    if (issuerWalletId) {
      await serviceClient.from('xrpl_issuer_wallets').update({
        updated_at: now,
      }).eq('id', issuerWalletId)
    }

    console.log(`Credential issued & committed: registration=${registration_id} credential=${credRow.id} tx=${txHash}`)

    return new Response(JSON.stringify({
      status: 'signed',
      signed: true,
      tx_hash: txHash,
      credential_id: credRow.id,
      ledger_status: 'issued',
      registration_status: 'approved',
      message: 'Credential issued on XRPL and registration approved.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    })

  } catch (error) {
    console.error('Error in check-credential-payload:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})
