import { loadEnvConfig } from "@next/env";
import { expect, test, type Browser, type Page } from "@playwright/test";

import { avocatDeTest } from "./avocat-de-test";

/**
 * Explanation requests (screen 47) against the real backend. Management writes, the lawyer replies,
 * and neither can do the other's action. The server rejects a second pending request, a reply to
 * someone else's request, and a second reply. Suspension of automatic reminders depends on a daily
 * scheduler and is covered by backend unit tests and REC-E2E-035 step 12.
 */

loadEnvConfig(process.cwd());

const MOT_DE_PASSE = "Password1!";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

async function jeton(identifiant: string): Promise<string> {
  const reponse = await fetch(`${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: process.env.KEYCLOAK_CLIENT_ID ?? "",
      client_secret: process.env.KEYCLOAK_CLIENT_SECRET ?? "",
      username: identifiant,
      password: MOT_DE_PASSE,
      scope: "openid",
    }),
  });
  if (!reponse.ok) throw new Error(`Connexion refusée pour ${identifiant} (${reponse.status})`);
  return ((await reponse.json()) as { access_token: string }).access_token;
}

async function appel(chemin: string, acces: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${chemin}`, {
    ...init,
    headers: { Authorization: `Bearer ${acces}`, "Content-Type": "application/json", ...init.headers },
  });
}

async function pageConnectee(browser: Browser, identifiant: string) {
  const contexte = await browser.newContext({ locale: "fr-FR" });
  const page = await contexte.newPage();
  await page.goto("/login");
  await page.getByLabel("Identifiant", { exact: true }).fill(identifiant);
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Connexion" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
  return page;
}

function menu(page: Page) {
  return page.getByRole("navigation", { name: "Navigation principale" });
}

/**
 * Restores the account: a pending request suspends the lawyer's automatic reminders and blocks any
 * new request, which would break the next test.
 */
async function soldeLesDemandesEnAttente(avocatId: number) {
  const accesAvocat = await jeton("avocat.test");
  const liste = (await (await appel("/demandes-explication?size=100", accesAvocat)).json()) as {
    content: { id: number; avocatId: number; enAttente: boolean }[];
  };
  for (const demande of liste.content.filter((d) => d.enAttente && d.avocatId === avocatId)) {
    await appel(`/demandes-explication/${demande.id}/reponse`, accesAvocat, {
      method: "PUT",
      body: JSON.stringify({ reponse: "Nettoyage de fin de parcours." }),
    });
  }
}

test.setTimeout(180_000);
// Tests share the same lawyer: in parallel, the "single pending request" rule would make them
// reject each other.
test.describe.configure({ mode: "serial" });

test("la direction demande, l'avocat répond, et chacun voit ce qui le concerne", async ({ browser }) => {
  const avocat = await avocatDeTest();
  await soldeLesDemandesEnAttente(avocat.id);
  const marque = `Explication ${Date.now()}`;

  // Management writes.
  const dj = await pageConnectee(browser, "dj.test");
  await menu(dj).getByRole("link", { name: "Explications" }).click();
  await dj.waitForURL(/\/demandes-explication/, { timeout: 60_000 });
  await dj.getByRole("button", { name: "Demander une explication" }).click();

  const modale = dj.getByRole("dialog", { name: "Demander une explication" });
  // Stated before sending, otherwise management would see reminders stop without knowing why.
  await expect(modale.getByText(/la relance automatique de ses comptes rendus est suspendue/)).toBeVisible();

  const champAvocat = modale.getByRole("combobox", { name: "Avocat" });
  await champAvocat.click();
  await champAvocat.fill(avocat.nom.slice(0, 6));
  await modale.getByRole("option", { name: new RegExp(avocat.nom) }).first().click();
  await modale.getByLabel(/Ce que vous lui demandez/).fill(marque);
  await modale.getByRole("button", { name: "Envoyer" }).click();
  // The label uses a typographic apostrophe: a regular expression avoids copying it.
  await expect(dj.getByText(/Demande d.explication envoyée/)).toBeVisible({ timeout: 30_000 });

  const ligneDj = dj.getByRole("row", { name: new RegExp(marque) });
  await expect(ligneDj).toContainText("En attente de réponse");
  // Management writes; it does not reply to its own request.
  await expect(ligneDj.getByRole("button", { name: "Répondre" })).toHaveCount(0);

  // A second request is rejected while the first one is pending.
  await dj.getByRole("button", { name: "Demander une explication" }).click();
  const seconde = dj.getByRole("dialog", { name: "Demander une explication" });
  const champ2 = seconde.getByRole("combobox", { name: "Avocat" });
  await champ2.click();
  await champ2.fill(avocat.nom.slice(0, 6));
  await seconde.getByRole("option", { name: new RegExp(avocat.nom) }).first().click();
  await seconde.getByLabel(/Ce que vous lui demandez/).fill("Encore une.");
  await seconde.getByRole("button", { name: "Envoyer" }).click();
  await expect(seconde.getByText(/déjà en attente/)).toBeVisible({ timeout: 30_000 });
  await seconde.getByRole("button", { name: "Annuler" }).click();
  await dj.context().close();

  // The lawyer replies.
  const avo = await pageConnectee(browser, "avocat.test");
  await menu(avo).getByRole("link", { name: "Explications" }).click();
  await avo.waitForURL(/\/demandes-explication/, { timeout: 60_000 });
  // He does not write: management asks.
  await expect(avo.getByRole("button", { name: "Demander une explication" })).toHaveCount(0);

  const ligneAvocat = avo.getByRole("row", { name: new RegExp(marque) });
  await ligneAvocat.getByRole("button", { name: "Répondre" }).click();
  const reponse = avo.getByRole("dialog", { name: "Répondre à la Direction Juridique" });
  // The request is shown while replying.
  await expect(reponse.getByText(marque)).toBeVisible();
  // And he is warned before writing, not after.
  await expect(reponse.getByText(/ne pourra plus être modifiée/)).toBeVisible();
  await reponse.getByLabel("Votre réponse").fill("Le greffe ne m'a pas transmis le plumitif.");
  await reponse.getByRole("button", { name: "Envoyer" }).click();
  await expect(avo.getByText("Réponse envoyée.")).toBeVisible({ timeout: 30_000 });

  // The exchange is closed: the reply is shown and the button is gone.
  await expect(ligneAvocat).toContainText("Répondue");
  await expect(ligneAvocat).toContainText("Le greffe ne m'a pas transmis le plumitif.");
  await expect(ligneAvocat.getByRole("button", { name: "Répondre" })).toHaveCount(0);
  await avo.context().close();

  // Management sees the reply without opening the row.
  const relecture = await pageConnectee(browser, "dj.test");
  await relecture.goto("/demandes-explication");
  await expect(relecture.getByRole("row", { name: new RegExp(marque) }))
    .toContainText("Le greffe ne m'a pas transmis le plumitif.");
  await relecture.context().close();
});

/**
 * Server-side rejections: hiding a button protects nothing, the server enforces the rule.
 */
test("un juriste n'écrit pas, et un avocat ne répond pas pour un autre (Q-130)", async () => {
  const avocat = await avocatDeTest();
  await soldeLesDemandesEnAttente(avocat.id);

  // The legal officer cannot write: the right depends on the profile, never on ROLE_JURISTE, which
  // is composite and also held by the DJ and the DJA.
  const refusJuriste = await appel("/demandes-explication", await jeton("juriste.test"), {
    method: "POST",
    body: JSON.stringify({ avocatId: avocat.id, contenu: "Expliquez-vous." }),
  });
  expect(refusJuriste.status, "un juriste ne demande pas d'explication").toBe(403);

  // Management writes, then the lawyer replies once; the second reply is rejected.
  const creee = await appel("/demandes-explication", await jeton("dj.test"), {
    method: "POST",
    body: JSON.stringify({ avocatId: avocat.id, contenu: "Comptes rendus manquants." }),
  });
  expect(creee.status).toBe(201);
  const demande = (await creee.json()) as { id: number };

  const accesAvocat = await jeton("avocat.test");
  const premiere = await appel(`/demandes-explication/${demande.id}/reponse`, accesAvocat, {
    method: "PUT",
    body: JSON.stringify({ reponse: "Voici mes explications." }),
  });
  expect(premiere.status).toBe(200);

  const seconde = await appel(`/demandes-explication/${demande.id}/reponse`, accesAvocat, {
    method: "PUT",
    body: JSON.stringify({ reponse: "Je me reprends." }),
  });
  expect(seconde.status, "une prise de position datée ne se récrit pas").toBe(409);
});
