import { defineConfig, devices } from "@playwright/test";

/**
 * Les parcours de bout en bout s'exécutent contre l'application réelle. À partir du jalon F2 ils
 * exigeront aussi le backend et Keycloak démarrés — les tests concernés seront marqués comme tels
 * plutôt que simulés.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  /**
   * 30 s (défaut) ne suffisent pas ici : un parcours d'authentification traverse un **vrai** serveur
   * Keycloak et, en mode développement, Next compile chaque route au premier accès. Le délai est
   * relevé pour cette réalité, non pour masquer une lenteur applicative — les cibles de performance
   * se mesurent sur un build de production (NF-PERF-01, jalon F17).
   */
  timeout: 90_000,
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
