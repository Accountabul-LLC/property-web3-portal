import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

const MAINNET_NODES = ["https://s2.ripple.com:51234", "https://s1.ripple.com:51234", "https://xrplcluster.com"];
const TESTNET_NODES = ["https://s.altnet.rippletest.net:51234", "https://testnet.xrpl-labs.com"];
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

type Asset =
  | { kind: "xrp" }
  | { kind: "token"; currency: string; issuer: string };

function isValidXRPLAddress(addr: string): boolean {
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(addr);
}

function isValidCurrency(currency: string): boolean {
  return typeof currency === "string" && currency.trim().length > 0 && currency.trim().length <= 40;
}

function isPositiveDecimal(s: string): boolean {
  return /^\d+(\.\d+)?$/.test(s) && Number(s) > 0;
}

function hasAtMostSixDecimals(s: string): boolean {
  const parts = s.split('.');
  return parts.length < 2 || parts[1].length <= 6;
}

function toDrops(xrp: string): string {
  const [whole, frac = ""] = xrp.split(".");
  const padded = (frac + "000000").slice(0, 6);
  return String((BigInt(whole) * 1_000_000n) + BigInt(padded));
}

function assetToAmount(asset: Asset, value: string): string | Record<string, string> {
  if (asset.kind === "xrp") return toDrops(value);
  return { currency: asset.currency, issuer: asset.issuer, value };
}

function normalizeXrpAmount(value: unknown): string | null {
  if (typeof value === "string" && /^\d+$/.test(value)) return (Number(value) / 1_000_000).toFixed(6).replace(/\.?0+$/, "");
  return null;
}

async function xrplRequest(nodes: string[], method: string, params: Record<string, unknown>[]) {
  let lastError: Error | null = null;

  for (const node of nodes) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));

        const res = await fetch(node, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method, params }),
        });

        if (res.status === 429 || res.status === 503) {
          lastError = new Error(`${node} returned ${res.status}`);
          if (attempt < MAX_RETRIES) continue;
          break;
        }

        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          lastError = new Error(`Non-JSON from ${node}: ${text.slice(0, 120)}`);
          break;
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        break;
      }
    }
  }

  throw lastError ?? new Error("All XRPL nodes failed");
}

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Authentication required", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return jsonError("Invalid authentication", 401);
    }

    const {
      wallet_address,
      source_asset,
      destination_asset,
      source_amount,
      network,
    } = await req.json();

    const nodes = network === "testnet" ? TESTNET_NODES : MAINNET_NODES;

    if (!wallet_address || !isValidXRPLAddress(wallet_address)) return jsonError("Valid wallet_address is required");
    if (!source_asset || !destination_asset) return jsonError("source_asset and destination_asset are required");
    if (source_asset.kind !== "xrp" && (!isValidCurrency(source_asset.currency) || !isValidXRPLAddress(source_asset.issuer))) {
      return jsonError("Invalid source token asset");
    }
    if (destination_asset.kind !== "xrp" && (!isValidCurrency(destination_asset.currency) || !isValidXRPLAddress(destination_asset.issuer))) {
      return jsonError("Invalid destination token asset");
    }
    if (source_asset.kind === destination_asset.kind && source_asset.kind === "xrp") {
      return jsonError("Swap pair must change assets");
    }
    if (source_asset.kind === "token" && destination_asset.kind === "token" &&
      source_asset.currency === destination_asset.currency &&
      source_asset.issuer === destination_asset.issuer) {
      return jsonError("Swap pair must change assets");
    }
    if (!source_amount || typeof source_amount !== "string" || !isPositiveDecimal(source_amount)) {
      return jsonError("source_amount must be a positive decimal string");
    }
    if (source_asset.kind === "xrp" && !hasAtMostSixDecimals(source_amount)) {
      return jsonError("XRP amount can use at most 6 decimal places");
    }

    const { data: walletLink } = await supabaseAdmin
      .from("user_wallets")
      .select("id")
      .eq("wallet_address", wallet_address)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!walletLink) {
      return jsonError("Wallet not linked to your account. Please connect it first.", 403);
    }

    const { data: tradeEnabled, error: tradeError } = await supabaseAdmin.rpc("is_wallet_trade_enabled", {
      p_wallet_address: wallet_address,
    });
    if (tradeError) {
      return jsonError("Unable to verify trading access", 500);
    }
    if (!tradeEnabled) {
      return jsonError("Trading is not enabled for this wallet.", 403);
    }

    const warnings: string[] = [];

    const [accountInfoRes, sourceLinesRes, destinationLinesRes, serverInfoRes] = await Promise.all([
      xrplRequest(nodes, "account_info", [{ account: wallet_address, ledger_index: "validated" }]),
      source_asset.kind === "token"
        ? xrplRequest(nodes, "account_lines", [{ account: wallet_address, peer: source_asset.issuer, ledger_index: "validated" }])
        : Promise.resolve(null),
      destination_asset.kind === "token"
        ? xrplRequest(nodes, "account_lines", [{ account: wallet_address, peer: destination_asset.issuer, ledger_index: "validated" }])
        : Promise.resolve(null),
      xrplRequest(nodes, "server_info", [{}]),
    ]);

    if (accountInfoRes.result?.error === "actNotFound") {
      return jsonError("Wallet account not found on XRPL", 400);
    }

    const accountData = accountInfoRes.result?.account_data;
    if (!accountData) return jsonError("Could not fetch wallet account data", 500);

    let insufficientBalance = false;
    if (source_asset.kind === "xrp") {
      const balanceXrp = Number(accountData.Balance) / 1_000_000;
      const reserveXrp = 1 + (Number(accountData.OwnerCount || 0) * 0.2);
      const spendable = balanceXrp - reserveXrp;
      if (Number(source_amount) > spendable) {
        insufficientBalance = true;
        warnings.push(`Insufficient spendable XRP. You have ${spendable.toFixed(6)} XRP available.`);
      } else if (spendable - Number(source_amount) < 1) {
        warnings.push("This swap will leave your spendable XRP very low.");
      }
    } else {
      const sourceLines = sourceLinesRes?.result?.lines || [];
      const sourceLine = sourceLines.find((line: any) => line.currency === source_asset.currency && line.account === source_asset.issuer);
      if (!sourceLine) {
        insufficientBalance = true;
        warnings.push("You do not have a trustline for the source token.");
      } else if (sourceLine.freeze_peer) {
        insufficientBalance = true;
        warnings.push("The source token is frozen by the issuer.");
      } else if (Number(source_amount) > Number(sourceLine.balance)) {
        insufficientBalance = true;
        warnings.push(`Insufficient token balance. You have ${sourceLine.balance} ${source_asset.currency} available.`);
      }
    }

    let trustlineMissing: { currency: string; issuer: string } | null = null;
    if (destination_asset.kind === "token") {
      const destinationLines = destinationLinesRes?.result?.lines || [];
      const destinationLine = destinationLines.find((line: any) => line.currency === destination_asset.currency && line.account === destination_asset.issuer);
      if (!destinationLine) {
        trustlineMissing = {
          currency: destination_asset.currency,
          issuer: destination_asset.issuer,
        };
        warnings.push("You'll need a trustline before this swap can execute.");
      }
    }

    const destinationAmount =
      destination_asset.kind === "xrp"
        ? "-1"
        : { currency: destination_asset.currency, issuer: destination_asset.issuer, value: "-1" };

    const pathFind = await xrplRequest(nodes, "ripple_path_find", [{
      source_account: wallet_address,
      destination_account: wallet_address,
      destination_amount: destinationAmount,
      send_max: assetToAmount(source_asset, source_amount),
      ledger_index: "validated",
    }]);

    if (pathFind.result?.error) {
      return new Response(JSON.stringify({
        success: false,
        error: "no_route",
        message: `Path finding failed: ${pathFind.result.error_message || pathFind.result.error}`,
        warnings,
        trustline_required: trustlineMissing,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const alternatives = pathFind.result?.alternatives || [];
    if (alternatives.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: "no_route",
        message: "No swap route found for this pair.",
        warnings,
        trustline_required: trustlineMissing,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const best = alternatives[0];
    const quotedDestination = best.destination_amount ?? pathFind.result.destination_amount ?? null;
    const quotedSource = best.source_amount ?? assetToAmount(source_asset, source_amount);
    const paths = best.paths_computed ?? [];

    const validatedLedger = serverInfoRes.result?.info?.validated_ledger?.seq || 0;
    const lastLedgerSequence = validatedLedger + 20;
    const feeDrops = "12";

    const txJson: Record<string, unknown> = {
      TransactionType: "Payment",
      Account: wallet_address,
      Destination: wallet_address,
      Amount: quotedDestination,
      SendMax: quotedSource,
      Paths: paths,
      Fee: feeDrops,
      LastLedgerSequence: lastLedgerSequence,
    };

    const sourceAmountXrp = source_asset.kind === "xrp" ? Number(source_amount) : null;
    const destinationAmountXrp = normalizeXrpAmount(quotedDestination);
    if (sourceAmountXrp !== null && destinationAmountXrp !== null) {
      const slippageXrp = Math.max(0, sourceAmountXrp - Number(destinationAmountXrp));
      if (slippageXrp < 0.001) warnings.push("Quoted route is very tight. Re-quote before signing if the market moves.");
    }

    return new Response(JSON.stringify({
      success: true,
      tx_json: txJson,
      quote: {
        source_asset,
        destination_asset,
        source_amount,
        quoted_source_amount: quotedSource,
        quoted_destination_amount: quotedDestination,
        alternative_count: alternatives.length,
        full_reply: pathFind.result?.full_reply ?? false,
        validated: pathFind.result?.validated ?? false,
      },
      fee_drops: feeDrops,
      fee_xrp: Number(feeDrops) / 1_000_000,
      warnings,
      insufficient_balance: insufficientBalance,
      trustline_required: trustlineMissing,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Swap build error:", error);
    return jsonError(error instanceof Error ? error.message : String(error), 500);
  }
});
