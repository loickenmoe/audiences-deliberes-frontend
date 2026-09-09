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
   * Keycloak et, en mode développement, Next compile chaque route au premier accès.
   *
   * Relevé à 180 s après mesure (2026-09-09) : même serveur chaud, une navigation douce du routeur
   * App demande ~5 s en développement — l'URL ne change qu'à l'arrivée de la charge RSC. Un test qui
   * enchaîne connexion, liste et fiche traverse quatre routes et dépassait les 90 s **sans que rien
   * ne soit cassé** : le même parcours joué à la main aboutit.
   *
   * Ce délai compense l'outil de développement, il ne masque aucune lenteur applicative : les
   * cibles de performance se mesurent sur un build de production (NF-PERF-01, jalon F17). La suite
   * gagnerait d'ailleurs à s'exécuter contre `next build && next start` — à trancher en F17.
   */
  timeout: 180_000,
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
    // Compilation à froid : après un `rm -rf .next`, Next reconstruit tout avant de répondre.
    // 120 s ne suffisent pas sur ce poste.
    timeout: 300_000,
  },
});
