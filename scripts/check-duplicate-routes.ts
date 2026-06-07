/**
 * Build-time check that fails if duplicate routes or duplicate page
 * components are registered in src/App.tsx.
 *
 * - Duplicate route paths => error (two <Route path="X"> declarations).
 * - Same page component mounted at multiple distinct paths => error.
 *
 * Wrapper components (RouteGuard, KycGate, Navigate, Suspense, etc.) and
 * redirect-only routes using <Navigate /> are ignored for the
 * duplicate-component check.
 */
import fs from "node:fs";
import path from "node:path";

const WRAPPER_COMPONENTS = new Set([
  "RouteGuard",
  "KycGate",
  "Navigate",
  "Suspense",
  "RouteSeo",
  "WalletActivityWatcher",
  "Routes",
  "Route",
  "BrowserRouter",
]);

export interface RouteEntry {
  path: string;
  component: string | null; // null = redirect / wrapper-only
  line: number;
  isRedirect: boolean;
}

export function parseRoutes(source: string): RouteEntry[] {
  const lines = source.split("\n");
  const entries: RouteEntry[] = [];
  // Match: <Route path="..." element={ ... } />
  const routeRe = /<Route\s+path=["']([^"']+)["']\s+element=\{([\s\S]*?)\}\s*\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = routeRe.exec(source)) !== null) {
    const [full, routePath, element] = m;
    const line = source.slice(0, m.index).split("\n").length;
    const isRedirect = /<Navigate\b/.test(element);
    // Extract JSX component names: <Name ...> patterns.
    const compNames = Array.from(element.matchAll(/<([A-Z][A-Za-z0-9_]*)/g)).map(
      (x) => x[1],
    );
    const pageComponent =
      compNames.find((n) => !WRAPPER_COMPONENTS.has(n)) ?? null;
    entries.push({
      path: routePath,
      component: isRedirect ? null : pageComponent,
      line,
      isRedirect,
    });
  }
  return entries;
}

export interface CheckResult {
  errors: string[];
  routes: RouteEntry[];
}

export function checkRoutes(source: string): CheckResult {
  const routes = parseRoutes(source);
  const errors: string[] = [];

  // 1. Duplicate paths.
  const byPath = new Map<string, RouteEntry[]>();
  for (const r of routes) {
    const arr = byPath.get(r.path) ?? [];
    arr.push(r);
    byPath.set(r.path, arr);
  }
  for (const [p, list] of byPath) {
    if (list.length > 1) {
      errors.push(
        `Duplicate route path "${p}" declared ${list.length} times at lines ${list.map((r) => r.line).join(", ")}.`,
      );
    }
  }

  // 2. Duplicate page components mounted at multiple distinct paths.
  const byComp = new Map<string, RouteEntry[]>();
  for (const r of routes) {
    if (!r.component || r.isRedirect) continue;
    const arr = byComp.get(r.component) ?? [];
    arr.push(r);
    byComp.set(r.component, arr);
  }
  for (const [comp, list] of byComp) {
    const uniquePaths = Array.from(new Set(list.map((r) => r.path)));
    if (uniquePaths.length > 1) {
      errors.push(
        `Page component <${comp}/> is mounted at multiple paths: ${uniquePaths
          .map((p) => `"${p}"`)
          .join(", ")} (lines ${list.map((r) => r.line).join(", ")}). ` +
          `Use <Navigate /> for redirects instead of mounting the same page twice.`,
      );
    }
  }

  return { errors, routes };
}

export function runCheck(appTsxPath: string): CheckResult {
  const source = fs.readFileSync(appTsxPath, "utf8");
  return checkRoutes(source);
}

// CLI entrypoint
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  path.resolve(process.argv[1]).endsWith("check-duplicate-routes.ts");

if (isMain) {
  const target = path.resolve(process.cwd(), "src/App.tsx");
  const { errors } = runCheck(target);
  if (errors.length) {
    console.error("\n✗ Route duplication check failed:\n");
    for (const e of errors) console.error("  - " + e);
    process.exit(1);
  }
  console.log("✓ No duplicate routes or page components.");
}
