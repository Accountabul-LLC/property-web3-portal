import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { importPKCS8, SignJWT } from "https://deno.land/x/jose@v5.2.2/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ALLOWED_ORIGIN") ?? "https://accountabul.lovable.app",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Normalize PEM: fix literal \n, extra whitespace, missing headers
function normalizePem(raw: string): string {
  let pem = raw.replace(/\\n/g, "\n").trim();
  if (!pem.includes("-----BEGIN")) {
    const clean = pem.replace(/\s/g, "");
    const lines = clean.match(/.{1,64}/g) || [];
    pem = `-----BEGIN RSA PRIVATE KEY-----\n${lines.join("\n")}\n-----END RSA PRIVATE KEY-----`;
  }
  return pem;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function derLength(n: number): Uint8Array {
  if (n < 0x80) return new Uint8Array([n]);
  if (n < 0x100) return new Uint8Array([0x81, n]);
  if (n < 0x10000) return new Uint8Array([0x82, (n >> 8) & 0xff, n & 0xff]);
  return new Uint8Array([0x83, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]);
}

// Convert PKCS#1 PEM to PKCS#8 PEM (GitHub App keys are PKCS#1)
function ensurePkcs8Pem(rawPem: string): string {
  const pem = normalizePem(rawPem);

  if (pem.includes("BEGIN PRIVATE KEY")) return pem; // already PKCS#8

  const b64 = pem
    .replace(/-----BEGIN RSA PRIVATE KEY-----/, "")
    .replace(/-----END RSA PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  const pkcs1Bytes = base64ToUint8(b64);

  // RSA AlgorithmIdentifier OID
  const algorithmId = new Uint8Array([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86,
    0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
  ]);

  // OCTET STRING wrapper for PKCS#1 data
  const octetLenBytes = derLength(pkcs1Bytes.length);
  const octetString = new Uint8Array(1 + octetLenBytes.length + pkcs1Bytes.length);
  octetString[0] = 0x04;
  octetString.set(octetLenBytes, 1);
  octetString.set(pkcs1Bytes, 1 + octetLenBytes.length);

  // Version INTEGER 0
  const version = new Uint8Array([0x02, 0x01, 0x00]);

  // Outer SEQUENCE
  const innerLen = version.length + algorithmId.length + octetString.length;
  const seqLenBytes = derLength(innerLen);
  const pkcs8 = new Uint8Array(1 + seqLenBytes.length + innerLen);
  pkcs8[0] = 0x30;
  pkcs8.set(seqLenBytes, 1);
  let off = 1 + seqLenBytes.length;
  pkcs8.set(version, off); off += version.length;
  pkcs8.set(algorithmId, off); off += algorithmId.length;
  pkcs8.set(octetString, off);

  const b64Out = uint8ToBase64(pkcs8);
  const lines = b64Out.match(/.{1,64}/g) || [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----`;
}

async function createGitHubJWT(appId: string, privateKeyPem: string): Promise<string> {
  const pkcs8Pem = ensurePkcs8Pem(privateKeyPem);
  const privateKey = await importPKCS8(pkcs8Pem, "RS256");

  return await new SignJWT({ iss: appId })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 60)
    .setExpirationTime("10m")
    .sign(privateKey);
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
    console.error("GitHub installation token error:", res.status);
    throw new Error(`GitHub authentication failed (${res.status})`);
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
  if (!res.ok) throw new Error(`GitHub API error (${res.status}): ${data.message || 'Unknown'}`);
  return data;
}

// ─── Audit logging ────────────────────────────────────────────
async function logAction(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  action: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    await supabaseAdmin.from('integration_audit_log').insert({
      actor_id: userId,
      integration_type: 'github',
      action,
      metadata: { ...metadata, timestamp: new Date().toISOString() },
    })
  } catch { /* non-critical */ }
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

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Check admin role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
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
        JSON.stringify({ error: "GitHub integration not configured. Contact admin." }),
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

    // Audit log the action
    await logAction(supabaseAdmin, userId, `github_${action}`, { owner, repo });

    let result: unknown;

    switch (action) {
      case "list_repos": {
        const repos = await githubAPI(ghToken, `/installation/repositories?per_page=100`);
        result = {
          total_count: repos.total_count,
          repositories: repos.repositories?.map((r: any) => ({
            full_name: r.full_name,
            default_branch: r.default_branch,
            private: r.private,
          })) || [],
        };
        break;
      }

      case "get_tree": {
        const branch = params.branch || "main";
        
        async function listContents(path: string): Promise<Array<{ path: string; size: number }>> {
          const items = await githubAPI(ghToken, `/repos/${owner}/${repo}/contents/${path}${branch ? `?ref=${branch}` : ''}`);
          const files: Array<{ path: string; size: number }> = [];
          for (const item of Array.isArray(items) ? items : [items]) {
            if (item.type === 'file') {
              files.push({ path: item.path, size: item.size });
            } else if (item.type === 'dir' && !item.path.startsWith('node_modules') && !item.path.startsWith('.')) {
              const subFiles = await listContents(item.path);
              files.push(...subFiles);
            }
          }
          return files;
        }
        
        const files = await listContents('');
        result = {
          sha: 'contents-api',
          files: files.map(f => ({ path: f.path, size: f.size, sha: '' })),
        };
        break;
      }

      case "get_file": {
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
        const labels = params.labels || [];
        const issueBody: any = {
          title: params.title,
          body: params.body,
          labels,
        };
        if (params.milestone) issueBody.milestone = params.milestone;
        if (params.assignees?.length) issueBody.assignees = params.assignees;
        const issue = await githubAPI(ghToken, `/repos/${owner}/${repo}/issues`, "POST", issueBody);
        result = { number: issue.number, url: issue.html_url, title: issue.title, state: issue.state };
        break;
      }

      case "get_issue": {
        const issueNum = params.issue_number;
        if (!issueNum) throw new Error("issue_number is required for get_issue");
        const issue = await githubAPI(ghToken, `/repos/${owner}/${repo}/issues/${issueNum}`);
        result = {
          number: issue.number,
          url: issue.html_url,
          title: issue.title,
          state: issue.state,
          closed_at: issue.closed_at,
          labels: issue.labels?.map((l: any) => l.name) || [],
          pull_request: issue.pull_request ? { url: issue.pull_request.html_url, merged: !!issue.pull_request.merged_at } : null,
        };
        break;
      }

      case "list_issues": {
        const state = params.state || "open";
        const labelsFilter = params.labels_filter ? `&labels=${params.labels_filter}` : '';
        const issues = await githubAPI(ghToken, `/repos/${owner}/${repo}/issues?state=${state}&per_page=${params.per_page || 30}${labelsFilter}`);
        result = {
          count: issues.length,
          issues: issues.map((i: any) => ({
            number: i.number, title: i.title, state: i.state,
            closed_at: i.closed_at, labels: i.labels?.map((l: any) => l.name) || [],
          })),
        };
        break;
      }

      case "create_pr": {
        const baseBranch = params.base || "main";
        const branchName = params.branch_name || `agent/${Date.now()}`;
        const files = params.files as Array<{ path: string; content: string }>;

        if (!files?.length) throw new Error("files array required for create_pr");

        const baseRef = await githubAPI(ghToken, `/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`);
        const baseSha = baseRef.object.sha;

        await githubAPI(ghToken, `/repos/${owner}/${repo}/git/refs`, "POST", {
          ref: `refs/heads/${branchName}`,
          sha: baseSha,
        });

        for (const f of files) {
          const existing = await githubAPI(ghToken, `/repos/${owner}/${repo}/contents/${f.path}?ref=${branchName}`).catch(() => null);
          await githubAPI(ghToken, `/repos/${owner}/${repo}/contents/${f.path}`, "PUT", {
            message: params.commit_message || `Agent update: ${f.path}`,
            content: btoa(f.content),
            branch: branchName,
            ...(existing?.sha ? { sha: existing.sha } : {}),
          });
        }

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
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    // Sanitize: never leak raw error details that might contain tokens/keys
    const safeMessage = e instanceof Error ? e.message : "Unknown error";
    // Only log a safe summary
    console.error("github-agent error:", safeMessage);
    return new Response(
      JSON.stringify({ error: safeMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
