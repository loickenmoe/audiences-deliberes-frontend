import { loadEnvConfig } from "@next/env";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Saved signature (screen 46) against the real backend. Only a real browser upload to a real server
 * catches multipart transport issues (missing boundary), which unit tests mock away.
 *
 * Accounts are left as found: each test that uploads saves the existing signature first and
 * restores it afterwards, even on failure.
 */

loadEnvConfig(process.cwd());

const MOT_DE_PASSE = "Password1!";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

/** A tiny valid PNG: this journey checks transport, not the drawing. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
);

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

type Depot = { image: Buffer; type: string } | null;

/** What an account currently holds: its image and type, or nothing. */
async function signatureDe(acces: string): Promise<Depot> {
  const entetes = { Authorization: `Bearer ${acces}` };
  const etat = (await (await fetch(`${API}/utilisateurs/moi/signature`, { headers: entetes })).json()) as {
    deposee: boolean;
    type: string | null;
  };
  if (!etat.deposee) return null;
  const reponse = await fetch(`${API}/utilisateurs/moi/signature/image`, { headers: entetes });
  return { image: Buffer.from(await reponse.arrayBuffer()), type: etat.type ?? "image/png" };
}

/** Restores exactly what was there, including the absence of a signature. */
async function retablir(acces: string, origine: Depot): Promise<void> {
  const entetes = { Authorization: `Bearer ${acces}` };
  if (origine === null) {
    await fetch(`${API}/utilisateurs/moi/signature`, { method: "DELETE", headers: entetes });
    return;
  }
  const corps = new FormData();
  corps.append("fichier", new Blob([origine.image], { type: origine.type }), "signature");
  await fetch(`${API}/utilisateurs/moi/signature`, { method: "PUT", headers: entetes, body: corps });
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

async function monCompte(page: Page) {
  await page.goto("/mon-compte");
  await expect(page.getByRole("heading", { name: "Ma signature" })).toBeVisible({ timeout: 60_000 });
}

test.setTimeout(180_000);
// The journeys touch the same accounts: running them in parallel would make them interfere.
test.describe.configure({ mode: "serial" });

/** A real upload, then reading back what was uploaded, thumbnail and full size. */
test("le SH dépose sa signature, la voit, et l'ouvre en grand", async ({ browser }) => {
  const acces = await jeton("sh.test");
  const origine = await signatureDe(acces);
  const sh = await pageConnectee(browser, "sh.test");
  try {
    await monCompte(sh);
    await sh
      .locator('input[name="signature"]')
      .setInputFiles({ name: "signature.png", mimeType: "image/png", buffer: PNG });
    await expect(sh.getByText("Signature enregistrée.")).toBeVisible({ timeout: 30_000 });

    // Thumbnail, then full size: the image comes from the server, not a local cache.
    await expect(sh.getByAltText("Aperçu de ma signature")).toBeVisible({ timeout: 30_000 });
    await sh.getByRole("button", { name: "Aperçu", exact: true }).click();
    const apercu = sh.getByRole("dialog", { name: "Aperçu - signature.png" });
    await expect(apercu.getByRole("img")).toBeVisible({ timeout: 30_000 });
    await apercu.getByRole("button", { name: "Fermer" }).last().click();

    // The screen states its scope: it is not a legal guarantee.
    await expect(sh.getByText(/n’ajoute aucune valeur juridique/)).toBeVisible();

    // Removal, and what it announces: already signed letters do not change.
    await sh.getByRole("button", { name: "Retirer", exact: true }).click();
    const confirmation = sh.getByRole("dialog", { name: "Retirer votre signature ?" });
    await expect(confirmation.getByText(/Les lettres déjà signées ne changent pas/)).toBeVisible();
    await confirmation.getByRole("button", { name: "Retirer", exact: true }).click();
    await expect(sh.getByText("Signature retirée.")).toBeVisible({ timeout: 30_000 });
    await expect(sh.getByText("Aucune signature déposée.", { exact: false })).toBeVisible();
  } finally {
    await sh.context().close();
    await retablir(acces, origine);
  }
});

/**
 * PDFBox reads PNG and JPEG; a PDF would produce a letter without a signature. The upload field
 * refuses on the extension (the backend rule) before the screen sees the file; the MIME check
 * catches a lying extension and the server decides last. Nothing is sent and the user knows why.
 */
test("un PDF est refusé avant même de partir", async ({ browser }) => {
  const acces = await jeton("juriste.test");
  const avant = await signatureDe(acces);
  const juriste = await pageConnectee(browser, "juriste.test");
  try {
    await monCompte(juriste);
    await juriste
      .locator('input[name="signature"]')
      .setInputFiles({ name: "contrat.pdf", mimeType: "application/pdf", buffer: PDF });
    await expect(juriste.getByText(/Formats admis : PNG, JPG, JPEG/)).toBeVisible({ timeout: 30_000 });
    await expect(juriste.getByText("Signature enregistrée.")).toHaveCount(0);

    // Nothing was sent: the account holds exactly what it held before.
    const apres = await signatureDe(acces);
    expect(apres === null).toBe(avant === null);
    if (avant !== null && apres !== null) expect(apres.image.equals(avant.image)).toBe(true);
  } finally {
    await juriste.context().close();
  }
});

/**
 * Each user only sees their own signature, checked from the outside. Accounts may hold real
 * signatures, so the test asserts that the image served to the legal officer is never the SH's.
 */
test("la signature du SH reste invisible au juriste", async ({ browser }) => {
  const accesSh = await jeton("sh.test");
  const accesJuriste = await jeton("juriste.test");
  const origine = await signatureDe(accesSh);
  const sh = await pageConnectee(browser, "sh.test");
  try {
    await monCompte(sh);
    await sh
      .locator('input[name="signature"]')
      .setInputFiles({ name: "signature.png", mimeType: "image/png", buffer: PNG });
    await expect(sh.getByText("Signature enregistrée.")).toBeVisible({ timeout: 30_000 });

    const vueParLeSh = await signatureDe(accesSh);
    const vueParLeJuriste = await signatureDe(accesJuriste);
    expect(vueParLeSh?.image.equals(PNG)).toBe(true);
    // The legal officer receives their own signature, or nothing. Never the SH's.
    expect(vueParLeJuriste?.image.equals(PNG) ?? false).toBe(false);

    // On screen, the legal officer opens their account without seeing the SH's.
    const juriste = await pageConnectee(browser, "juriste.test");
    await monCompte(juriste);
    await expect(juriste.getByRole("heading", { name: "Ma signature" })).toBeVisible();
    await juriste.context().close();
  } finally {
    await sh.context().close();
    await retablir(accesSh, origine);
  }
});
