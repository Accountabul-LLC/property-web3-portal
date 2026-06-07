import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { runCheck } from "./scripts/check-duplicate-routes";

function duplicateRouteGuard(): Plugin {
  const appTsx = path.resolve(__dirname, "src/App.tsx");
  const run = (throwOnError: boolean) => {
    const { errors } = runCheck(appTsx);
    if (errors.length) {
      const msg =
        "Duplicate route check failed:\n" + errors.map((e) => "  - " + e).join("\n");
      if (throwOnError) throw new Error(msg);
      // dev: log only, don't crash HMR
      // eslint-disable-next-line no-console
      console.error("\n\x1b[31m" + msg + "\x1b[0m\n");
    }
  };
  return {
    name: "duplicate-route-guard",
    buildStart() {
      run(true);
    },
    configureServer(server) {
      run(false);
      server.watcher.add(appTsx);
      server.watcher.on("change", (file) => {
        if (path.resolve(file) === appTsx) run(false);
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: process.env.LOVABLE_SANDBOX ? "::" : "127.0.0.1",
    port: Number(process.env.PORT) || 5173,
    strictPort: false,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    duplicateRouteGuard(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
