import { expect, test, type Page } from "@playwright/test";

/**
 * Frontend security checks: emitted headers, token storage, and protected routes without a session.
 * Authorization itself belongs to the backend; hiding a screen does not protect it.
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
  // The stack must not advertise itself.
  expect(entetes["x-powered-by"]).toBeUndefined();
});

test("les en-têtes valent aussi pour une page authentifiée", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  const reponse = await page.goto("/dossiers");
  expect(reponse!.headers()["x-frame-options"]).toBe("DENY");
});

/**
 * The access token must never live in script-readable storage: it stays in the `httpOnly` NextAuth
 * session cookie, so an injection flaw cannot exfiltrate it.
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

  // The session cookie is not readable from the document either.
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
  // Unauthenticated: every business screen must redirect to the login form.
  for (const chemin of ["/", "/dossiers", "/frais", "/tableau-de-bord", "/admin/configurations", "/portail"]) {
    await page.goto(chemin);
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
  }
});

/**
 * Hiding a menu entry protects nothing: a forced URL must be refused too, by the route guard (same
 * capabilities as the navigation). The backend refuses the request anyway.
 */
test("une URL forcée vers un écran interdit est refusée", async ({ page }) => {
  await seConnecter(page, "assistante.test");

  // `/rapports` is open to the Assistant since 2026-10-21; the deletion arbitration stays with the DJ and DJA.
  for (const chemin of ["/tableau-de-bord", "/ged/demandes-suppression", "/portail"]) {
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

  // Going back must not revive the session: the guard runs server-side.
  await page.goto("/dossiers");
  await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
});
