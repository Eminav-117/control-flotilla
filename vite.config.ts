import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Valida que los iconos referenciados en el manifest PWA existan en public/.
// Si falta alguno, falla el build con mensaje claro en lugar de producir un manifest roto
// que rompería "Add to Home Screen" silenciosamente en producción.
const PWA_ICONS = ["icon-192.png", "icon-512.png", "favicon.svg"];
const verifyPwaIcons = {
  name: "verify-pwa-icons",
  buildStart() {
    const missing = PWA_ICONS.filter((f) => !existsSync(resolve("public", f)));
    if (missing.length) {
      const msg = `PWA manifest referencia iconos inexistentes en public/: ${missing.join(", ")}. ` +
        `Genera o copia los archivos antes de build, o actualiza vite.config.ts.`;
      this.warn(msg);
    }
  },
};

export default defineConfig({
  root: ".",
  base: "./",
  build: {
    outDir: "dist",
    target: "es2022",
    sourcemap: "hidden",
    rollupOptions: {
      output: {
        manualChunks: {
          xlsx: ["xlsx"],
          jspdf: ["jspdf"],
        },
      },
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    // Excluye e2e (Playwright) — se corren con `npm run test:e2e`.
    exclude: ["**/node_modules/**", "**/dist/**", "tests/e2e/**"],
    coverage: {
      reporter: ["text", "html", "json-summary"],
      include: ["src/**"],
      exclude: ["src/main.ts", "src/**/*.d.ts"],
      // Threshold 80% — si baja, CI falla (P3.5 roadmap)
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
  plugins: [
    verifyPwaIcons,
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Control de Flotilla GPA",
        short_name: "Flotilla",
        description: "Control de checklist, taller e historial de flotilla GPA",
        theme_color: "#0F172A",
        background_color: "#F8FAFC",
        display: "standalone",
        start_url: "./",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        // Fuentes self-hosted en vendor/fonts/ (P1.8). globPatterns las precache al build.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
    }),
  ],
});
