import { expect, test, type Page } from "@playwright/test";

/**
 * Revue de sécurité du frontend, tenue par des contrôles plutôt que par une note d'intention.
 *
 * Ce que ce fichier vérifie relève strictement de ce que le **frontend** maîtrise : les en-têtes
 * qu'il émet, l'endroit où vit le jeton, et le fait qu'aucune route protégée ne s'ouvre sans
 * session. L'autorisation elle-même appartient au backend — masquer un écran n'est pas le protéger,
 * et c'est pourquoi les parcours de droits interrogent aussi l'API directement.
 */

const MOT_DE_PASSE = "Password1!";

async function seConnecter(page: Page, identifiant: string) {
  await page.goto("/login");
  await page.getByLabel("Identifiant", { exact: true }).fill(identifiant);
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Connexion" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
}

test("les en-têtes de sécurité sont posés sur toutes les réponses", async ({ page }) => {
  const reponse = await page.goto("/login");
  const entetes = reponse!.headers();

  expect(entetes["x-frame-options"], "encadrement dans une page tierce").toBe("DENY");
  expect(entetes["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(entetes["x-content-type-options"], "devinette de type MIME").toBe("nosniff");
  expect(entetes["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(entetes["permissions-policy"]).toContain("camera=()");
  // La pile n'a pas à s'annoncer.
  expect(entetes["x-powered-by"]).toBeUndefined();
});

test("les en-têtes valent aussi pour une page authentifiée", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  const reponse = await page.goto("/dossiers");
  expect(reponse!.headers()["x-frame-options"]).toBe("DENY");
});

/**
 * Le jeton d'accès ne doit **jamais** vivre dans un stockage lisible par un script : il réside dans
 * le cookie de session de NextAuth, marqué `httpOnly`. Une faille d'injection ne peut alors pas
 * l'exfiltrer.
 */
test("aucun jeton n'est déposé dans un stockage accessible aux scripts", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers");

  const stockage = await page.evaluate(() => ({
    local: Object.entries(localStorage).map(([cle, valeur]) => `${cle}=${String(valeur).slice(0, 40)}`),
    session: Object.entries(sessionStorage).map(([cle, valeur]) => `${cle}=${String(valeur).slice(0, 40)}`),
  }));

  const suspect = (entrees: string[]) =>
    entrees.filter((e) => /eyJ|token|bearer|secret|password/i.test(e));
  expect(suspect(stockage.local), "localStorage").toEqual([]);
  expect(suspect(stockage.session), "sessionStorage").toEqual([]);

  // Et le cookie de session n'est pas lisible depuis le document.
  const cookiesLisibles = await page.evaluate(() => document.cookie);
  expect(cookiesLisibles).not.toMatch(/eyJ/);
});

test("le cookie de session est httpOnly et restreint aux requêtes de même site", async ({ page, context }) => {
  await seConnecter(page, "juriste.test");
  const cookies = await context.cookies();
  const session = cookies.find((c) => c.name.includes("session-token") || c.name.includes("authjs"));

  expect(session, "un cookie de session doit exister").toBeDefined();
  expect(session!.httpOnly, "le cookie de session doit être httpOnly").toBe(true);
  expect(["Lax", "Strict"]).toContain(session!.sameSite);
});

test("une route protégée renvoie vers la connexion sans session", async ({ page }) => {
  // Aucune authentification : chaque écran métier doit renvoyer au formulaire, jamais s'afficher.
  for (const chemin of ["/", "/dossiers", "/frais", "/tableau-de-bord", "/admin/configurations", "/portail"]) {
    await page.goto(chemin);
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
  }
});

/**
 * Masquer une entrée de menu ne protège rien : l'URL forcée doit être refusée elle aussi. C'est le
 * garde de route qui le fait, adossé aux mêmes capacités que la navigation — et le backend refuse
 * de toute façon la requête.
 */
test("une URL forcée vers un écran interdit est refusée", async ({ page }) => {
  await seConnecter(page, "assistante.test");

  for (const chemin of ["/tableau-de-bord", "/rapports", "/portail"]) {
    await page.goto(chemin);
    await expect(
      page.getByRole("heading", { name: "Vous n’avez pas les droits nécessaires" }),
      `${chemin} doit être refusé à l'Assistante`,
    ).toBeVisible({ timeout: 30_000 });
  }
});

test("la déconnexion ferme la session et interdit le retour en arrière", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.waitForURL(/\/login/, { timeout: 60_000 });

  // Revenir en arrière ne doit pas ressusciter la session : le garde s'exécute côté serveur.
  await page.goto("/dossiers");
  await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
});
