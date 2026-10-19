import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  /**
   * `postcss.config.mjs` declares plugins by name, a Next.js-specific syntax Vite cannot read. Tests
   * render no stylesheet, so PostCSS config discovery is bypassed.
   */
  css: { postcss: { plugins: [] } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // Playwright runs tests/e2e; Vitest must not pick them up.
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    coverage: {
      reporter: ["text", "html"],
      include: ["lib/**", "types/**", "components/**"],
    },
  },
});
