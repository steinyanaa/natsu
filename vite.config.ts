import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "strip-node-unrar-sourcemap-comments",
      enforce: "pre",
      transform(code, id) {
        if (!id.includes("node-unrar-js") || !id.endsWith(".js")) {
          return undefined;
        }

        return {
          code: code.replace(/^\/\/# sourceMappingURL=.*$/gm, ""),
          map: null
        };
      }
    },
    react()
  ],
  base: "./",
  build: {
    target: "chrome120",
    sourcemap: "hidden",
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("pdfjs-dist")) return "pdfjs";
          if (id.includes("@zip.js/zip.js")) return "zip";
          return undefined;
        }
      }
    }
  },
  worker: {
    format: "es"
  },
  optimizeDeps: {
    exclude: ["node-unrar-js"]
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true
  }
});
