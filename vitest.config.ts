import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  /**
   * `postcss.config.mjs` déclare ses greffons par nom, syntaxe propre à Next.js que Vite ne sait pas
   * interpréter. Les tests ne rendent aucune feuille de style : on court-circuite la découverte de
   * la configuration PostCSS plutôt que de dégrader celle de l'application.
   */
  css: { postcss: { plugins: [] } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // Playwright pilote tests/e2e ; Vitest ne doit pas tenter de les exécuter.
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    coverage: {
      reporter: ["text", "html"],
      include: ["lib/**", "types/**", "components/**"],
    },
  },
});
