import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: process.env.LOVABLE_SANDBOX ? "::" : "127.0.0.1",
    port: Number(process.env.PORT) || 5173,
    strictPort: false,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("@radix-ui")) return "radix-vendor";
          if (id.includes("@supabase")) return "supabase-vendor";
          if (id.includes("@tanstack")) return "query-vendor";
          if (id.includes("@stripe")) return "stripe-vendor";
          if (id.includes("react-router-dom")) return "router-vendor";
          if (id.includes("react-dom") || id.includes("/react/")) return "react-vendor";
          if (id.includes("recharts")) return "charts-vendor";
          if (id.includes("lucide-react")) return "icons-vendor";
          if (id.includes("date-fns")) return "date-vendor";
          if (id.includes("qrcode.react") || id.includes("html5-qrcode")) return "qr-vendor";
          if (id.includes("react-hook-form") || id.includes("@hookform/resolvers") || id.includes("zod")) return "forms-vendor";
          if (id.includes("next-themes")) return "theme-vendor";
          if (id.includes("embla-carousel-react")) return "carousel-vendor";
          if (id.includes("react-resizable-panels")) return "layout-vendor";

          return "vendor";
        },
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
