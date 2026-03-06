import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// PKCS#1 to PKCS#8 wrapper for RSA keys (GitHub App keys are PKCS#1)
function pkcs1ToPkcs8(pkcs1Bytes: Uint8Array): Uint8Array {
  // PKCS#8 wraps PKCS#1 in: SEQUENCE { version INTEGER(0), algorithm AlgorithmIdentifier, OCTET STRING { pkcs1 } }
  const algorithmIdentifier = new Uint8Array([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86,
    0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
  ]);

  function derLength(len: number): Uint8Array {
    if (len < 0x80) return new Uint8Array([len]);
    if (len < 0x100) return new Uint8Array([0x81, len]);
    return new Uint8Array([0x82, (len >> 8) & 0xff, len & 0xff]);
  }

  // OCTET STRING wrapping pkcs1
  const octetLen = derLength(pkcs1Bytes.length);
  const octetString = new Uint8Array(1 + octetLen.length + pkcs1Bytes.length);
  octetString[0] = 0x04;
  octetString.set(octetLen, 1);
  octetString.set(pkcs1Bytes, 1 + octetLen.length);

  // version INTEGER 0
  const version = new Uint8Array([0x02, 0x01, 0x00]);

  // inner content
  const innerLen = version.length + algorithmIdentifier.length + octetString.length;
  const seqLen = derLength(innerLen);
  const result = new Uint8Array(1 + seqLen.length + innerLen);
  result[0] = 0x30;
  result.set(seqLen, 1);
  let offset = 1 + seqLen.length;
  result.set(version, offset); offset += version.length;
  result.set(algorithmIdentifier, offset); offset += algorithmIdentifier.length;
  result.set(octetString, offset);
  return result;
}

// GitHub App JWT generation using Web Crypto API
async function createGitHubJWT(appId: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = { iat: now - 60, exp: now + 600, iss: appId };

  const b64url = (data: Uint8Array) =>
    btoa(String.fromCharCode(...data))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const enc = new TextEncoder();
  const headerB64 = b64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = b64url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const isPkcs1 = privateKeyPem.includes("BEGIN RSA PRIVATE KEY");
  const pemBody = privateKeyPem
    .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/, "")
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  let keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  if (isPkcs1) {
    keyBytes = pkcs1ToPkcs8(keyBytes);
  }

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, enc.encode(signingInput))
  );

  return `${signingInput}.${b64url(signature)}`;
}

async function getInstallationToken(appId: string, privateKey: string, installationId: string): Promise<string> {
  const jwt = await createGitHubJWT(appId, privateKey);
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub token error [${res.status}]: ${text}`);
  }
  const data = await res.json();
  return data.token;
}

async function githubAPI(token: string, path: string, method = "GET", body?: unknown) {
  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://api.github.com${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(`GitHub API error [${res.status}]: ${JSON.stringify(data)}`);
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Check admin role
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GitHub App credentials
    const appId = Deno.env.get("GITHUB_APP_ID");
    const privateKey = Deno.env.get("GITHUB_APP_PRIVATE_KEY");
    const installationId = Deno.env.get("GITHUB_APP_INSTALLATION_ID");

    if (!appId || !privateKey || !installationId) {
      return new Response(
        JSON.stringify({ error: "GitHub App credentials not configured. Add GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, and GITHUB_APP_INSTALLATION_ID secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, owner, repo, ...params } = await req.json();

    if (!owner || !repo) {
      return new Response(JSON.stringify({ error: "owner and repo are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ghToken = await getInstallationToken(appId, privateKey, installationId);

    let result: unknown;

    switch (action) {
      case "get_tree": {
        // Get repo file tree
        const branch = params.branch || "main";
        const tree = await githubAPI(ghToken, `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
        result = {
          sha: tree.sha,
          files: tree.tree
            .filter((t: any) => t.type === "blob")
            .map((t: any) => ({ path: t.path, size: t.size, sha: t.sha })),
        };
        break;
      }

      case "get_file": {
        // Read a single file
        const path = params.path;
        if (!path) throw new Error("path is required for get_file");
        const file = await githubAPI(ghToken, `/repos/${owner}/${repo}/contents/${path}${params.branch ? `?ref=${params.branch}` : ""}`);
        result = {
          path: file.path,
          content: file.encoding === "base64" ? atob(file.content.replace(/\n/g, "")) : file.content,
          sha: file.sha,
          size: file.size,
        };
        break;
      }

      case "create_issue": {
        const issue = await githubAPI(ghToken, `/repos/${owner}/${repo}/issues`, "POST", {
          title: params.title,
          body: params.body,
          labels: params.labels || [],
        });
        result = { number: issue.number, url: issue.html_url, title: issue.title };
        break;
      }

      case "create_pr": {
        // Create a branch, commit changes, open PR
        const baseBranch = params.base || "main";
        const branchName = params.branch_name || `agent/${Date.now()}`;
        const files = params.files as Array<{ path: string; content: string }>;

        if (!files?.length) throw new Error("files array required for create_pr");

        // Get base ref
        const baseRef = await githubAPI(ghToken, `/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`);
        const baseSha = baseRef.object.sha;

        // Create branch
        await githubAPI(ghToken, `/repos/${owner}/${repo}/git/refs`, "POST", {
          ref: `refs/heads/${branchName}`,
          sha: baseSha,
        });

        // Commit each file
        for (const f of files) {
          const existing = await githubAPI(ghToken, `/repos/${owner}/${repo}/contents/${f.path}?ref=${branchName}`).catch(() => null);
          await githubAPI(ghToken, `/repos/${owner}/${repo}/contents/${f.path}`, "PUT", {
            message: params.commit_message || `Agent update: ${f.path}`,
            content: btoa(f.content),
            branch: branchName,
            ...(existing?.sha ? { sha: existing.sha } : {}),
          });
        }

        // Create PR
        const pr = await githubAPI(ghToken, `/repos/${owner}/${repo}/pulls`, "POST", {
          title: params.title || "Agent proposed changes",
          body: params.body || "Changes proposed by AI agent.",
          head: branchName,
          base: baseBranch,
        });

        result = { number: pr.number, url: pr.html_url, branch: branchName };
        break;
      }

      case "store_memory": {
        // Store a memory note
        const { data, error } = await supabase.from("agent_memory").upsert(
          {
            user_id: userId,
            category: params.category || "general",
            key: params.key,
            content: params.content,
            metadata: params.metadata || {},
          },
          { onConflict: "user_id,key" }
        );
        if (error) throw new Error(error.message);
        result = { stored: true };
        break;
      }

      case "recall_memory": {
        // Recall memories by category or key
        let query = supabase.from("agent_memory").select("*").eq("user_id", userId);
        if (params.category) query = query.eq("category", params.category);
        if (params.key) query = query.eq("key", params.key);
        const { data, error } = await query.order("updated_at", { ascending: false }).limit(params.limit || 20);
        if (error) throw new Error(error.message);
        result = data;
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}. Supported: get_tree, get_file, create_issue, create_pr, store_memory, recall_memory` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("github-agent error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
