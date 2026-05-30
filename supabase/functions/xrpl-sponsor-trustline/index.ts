// Sponsors a user's trustline by funding the 0.2 XRP reserve from a treasury
// wallet, then either signing the TrustSet server-side on testnet (where we
// hold the user's faucet seed) or returning the unsigned TrustSet JSON so
// the client can push it through Xaman (mainnet).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Client, Wallet, xrpToDrops } from "npm:xrpl@3.1.0";
import { parseJsonBody } from "../_shared/auth.ts";

const ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version';
function buildCors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = /^https:\/\/([a-z0-9-]+\.)*(lovable\.app|lovableproject\.com)$/i.test(origin)
    || origin === (Deno.env.get('APP_ALLOWED_ORIGIN') ?? 'https://accountabul.lovable.app');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : (Deno.env.get('APP_ALLOWED_ORIGIN') ?? 'https://accountabul.lovable.app'),
    'Access-Control-Allow-Headers': ALLOW_HEADERS,
    'Vary': 'Origin',
  };
}

const NODES: Record<string, string> = {
  mainnet: "wss://s2.ripple.com",
  testnet: "wss://s.altnet.rippletest.net:51233",
};

// Exactly the owner reserve (0.2 XRP) for one TrustLine object + a tiny buffer
// to cover the user's TrustSet network fee (~12 drops). No extra XRP given.
const SPONSOR_AMOUNT_XRP = "0.2001";
const TRUSTLINE_LIMIT = "999999999999";
const DAILY_LIMIT_PER_WALLET = 3;

function isValidXRPLAddress(addr: string): boolean {
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(addr);
}

function jsonError(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ success: false, error: message, ...extra }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let client: Client | null = null;
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonError("Authentication required", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) return jsonError("Invalid authentication", 401);

    const body = await parseJsonBody<{ wallet_address?: unknown; currency?: unknown; issuer?: unknown; network?: unknown }>(req, corsHeaders);
    if (body instanceof Response) return body;
    const { wallet_address, currency, issuer, network } = body;
    if (!wallet_address || !isValidXRPLAddress(wallet_address)) return jsonError("Valid wallet_address required");
    if (!issuer || !isValidXRPLAddress(issuer)) return jsonError("Valid issuer required");
    if (!currency || typeof currency !== "string") return jsonError("currency required");
    const net = network === "mainnet" || network === "testnet" ? network : "mainnet";

    // Verify wallet ownership
    const { data: walletLink } = await admin
      .from("user_wallets")
      .select("id, wallet_secret")
      .eq("wallet_address", wallet_address)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();
    if (!walletLink) return jsonError("Wallet not linked to your account", 403);

    // Rate limit: max N sponsorships per wallet per 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await admin
      .from("trustline_sponsorships")
      .select("id", { count: "exact", head: true })
      .eq("wallet_address", wallet_address)
      .gte("created_at", since);
    if ((recentCount ?? 0) >= DAILY_LIMIT_PER_WALLET) {
      return jsonError(`Daily trustline sponsorship limit reached (${DAILY_LIMIT_PER_WALLET}/24h)`, 429);
    }

    // Load sponsor secret
    const sponsorSecretEnv = `TRUSTLINE_SPONSOR_SECRET_${net.toUpperCase()}`;
    const sponsorSecret = Deno.env.get(sponsorSecretEnv);
    if (!sponsorSecret) {
      return jsonError(`Trustline sponsor not configured for ${net}. Missing ${sponsorSecretEnv}.`, 503);
    }

    // Connect to XRPL
    client = new Client(NODES[net]);
    await client.connect();

    // Idempotency: re-check trustline
    const existing = await client.request({
      command: "account_lines",
      account: wallet_address,
      peer: issuer,
      ledger_index: "validated",
    });
    const lines = (existing.result as any)?.lines || [];
    if (lines.some((l: any) => l.currency === currency && l.account === issuer)) {
      await client.disconnect();
      return new Response(JSON.stringify({ success: true, already_trusted: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: fund the user from sponsor wallet
    const sponsorWallet = Wallet.fromSeed(sponsorSecret);

    let fundingTxHash: string | null = null;
    try {
      const fundingTx = await client.autofill({
        TransactionType: "Payment",
        Account: sponsorWallet.address,
        Destination: wallet_address,
        Amount: xrpToDrops(SPONSOR_AMOUNT_XRP),
      });
      const signed = sponsorWallet.sign(fundingTx);
      const submitted = await client.submitAndWait(signed.tx_blob);
      const meta = (submitted.result as any)?.meta;
      const txResult = typeof meta === "object" ? meta?.TransactionResult : null;
      if (txResult !== "tesSUCCESS") {
        throw new Error(`Funding failed: ${txResult || "unknown"}`);
      }
      fundingTxHash = signed.hash;
    } catch (err) {
      await client.disconnect();
      return jsonError(`Sponsor funding failed: ${err instanceof Error ? err.message : String(err)}`, 500);
    }

    // Record sponsorship
    const { data: sponsorshipRow } = await admin
      .from("trustline_sponsorships")
      .insert({
        wallet_address,
        user_id: user.id,
        currency,
        issuer,
        network: net,
        funding_tx_hash: fundingTxHash,
        funded_amount_xrp: Number(SPONSOR_AMOUNT_XRP),
        status: "funded",
      })
      .select("id")
      .single();

    // Step 2: build TrustSet
    const trustSet: Record<string, unknown> = {
      TransactionType: "TrustSet",
      Account: wallet_address,
      LimitAmount: {
        currency,
        issuer,
        value: TRUSTLINE_LIMIT,
      },
    };

    // Testnet: sign server-side if we have the user's seed
    if (net === "testnet" && walletLink.wallet_secret) {
      try {
        const userWallet = Wallet.fromSeed(walletLink.wallet_secret);
        const prepared = await client.autofill(trustSet as any);
        const signedTrust = userWallet.sign(prepared);
        const submitted = await client.submitAndWait(signedTrust.tx_blob);
        const meta = (submitted.result as any)?.meta;
        const txResult = typeof meta === "object" ? meta?.TransactionResult : null;
        if (txResult !== "tesSUCCESS") {
          throw new Error(`TrustSet failed: ${txResult || "unknown"}`);
        }
        if (sponsorshipRow?.id) {
          await admin
            .from("trustline_sponsorships")
            .update({
              status: "completed",
              trustline_tx_hash: signedTrust.hash,
              completed_at: new Date().toISOString(),
            })
            .eq("id", sponsorshipRow.id);
        }
        await client.disconnect();
        return new Response(JSON.stringify({
          success: true,
          already_trusted: true,
          sponsored: true,
          funding_tx_hash: fundingTxHash,
          trustline_tx_hash: signedTrust.hash,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (err) {
        await client.disconnect();
        return jsonError(`Auto-sign TrustSet failed: ${err instanceof Error ? err.message : String(err)}`, 500);
      }
    }

    // Mainnet: return unsigned TrustSet for Xaman
    await client.disconnect();
    return new Response(JSON.stringify({
      success: true,
      requires_signature: true,
      funding_tx_hash: fundingTxHash,
      sponsorship_id: sponsorshipRow?.id || null,
      tx_json: trustSet,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    try { await client?.disconnect(); } catch {}
    console.error("sponsor-trustline error:", error);
    return jsonError(error instanceof Error ? error.message : String(error), 500);
  }
});
