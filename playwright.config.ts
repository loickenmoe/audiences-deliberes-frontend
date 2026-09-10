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
  /**
   * Délai d'assertion par défaut relevé de 5 s à 20 s.
   *
   * Les 5 s de Playwright supposent une application déjà servie. Ici, chaque assertion peut attendre
   * une compilation de route à la demande, un aller-retour vers un vrai Keycloak et un vrai backend,
   * le tout avec plusieurs travailleurs en parallèle sur la même instance de développement. Des
   * assertions parfaitement valides échouaient alors par intermittence — c'était le harnais qui
   * mentait, pas l'application.
   *
   * La bonne réponse de fond est d'exécuter la suite contre un build de production
   * (`next build && next start`), qui supprime la compilation à la demande : à trancher en F17.
   */
  expect: { timeout: 20_000 },
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
    /**
     * **Build de production, pas serveur de développement.**
     *
     * En développement, Next compile chaque route au premier accès. Avec plusieurs travailleurs en
     * parallèle, cela produisait des échecs *intermittents et tournants* — quatre tests différents à
     * chaque exécution, tous parfaitement valides — et une suite de 17 minutes. Relever les délais
     * n'a fait que déplacer le problème : c'était le harnais qui mentait sur l'application.
     *
     * Servir un build de production supprime la compilation à la demande, rend la suite déterministe
     * et la rapproche de ce qui est réellement livré. Le coût est un build en tête d'exécution.
     */
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    // Compilation à froid : après un `rm -rf .next`, Next reconstruit tout avant de répondre.
    // 120 s ne suffisent pas sur ce poste.
    timeout: 300_000,
  },
});
