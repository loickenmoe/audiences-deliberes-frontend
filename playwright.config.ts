import { defineConfig, devices } from "@playwright/test";

/**
 * Les parcours de bout en bout s'exécutent contre l'application réelle. À partir du jalon F2 ils
 * exigeront aussi le backend et Keycloak démarrés — les tests concernés seront marqués comme tels
 * plutôt que simulés.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    locale: "fr-FR",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
