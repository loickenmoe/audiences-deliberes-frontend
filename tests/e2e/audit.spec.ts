import { loadEnvConfig } from "@next/env";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";

/**
 * Audit of recorded actions (screen 43) against the real backend: cross-cutting scope, filter by
 * person, and the trace left by every consultation.
 */

loadEnvConfig(process.cwd());

const MOT_DE_PASSE = "Password1!";

async function seConnecter(page: Page, identifiant: string) {
  await page.goto("/login");
  await page.getByLabel("Identifiant", { exact: true }).fill(identifiant);
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Connexion" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
}

async function pageConnectee(browser: Browser, identifiant: string) {
  const contexte = await browser.newContext({ locale: "fr-FR" });
  const page = await contexte.newPage();
  await seConnecter(page, identifiant);
  return page;
}

async function ouvrirAudit(page: Page) {
  await page.goto("/admin/audit");
  await expect(page.getByRole("heading", { name: "Audit", level: 1 })).toBeVisible({ timeout: 60_000 });
}

/**
 * Invalid-criteria messages are searched within the filter section: Next adds its own root
 * `role="alert"` for route announcements, which a global selector would match.
 */
function filtres(page: Page) {
  return page.getByRole("region", { name: "Filtres de l’audit" });
}

test("l'audit couvre tout l'historique et se restreint à un périmètre choisi (Q-112)", async ({
  browser,
}) => {
  const dj = await pageConnectee(browser, "dj.test");
  await ouvrirAudit(dj);

  /*
   * Filter on an action type rather than looking for a row on the first page: the audit is sorted
   * newest first, and the consultations this test triggers immediately take the top rows.
   */
  const action = dj.getByLabel("Action", { exact: true });
  await expect.poll(() => action.locator("option").count(), { timeout: 30_000 }).toBeGreaterThan(1);
  await action.selectOption({ label: "Création du dossier" });

  // Default scope: the whole history, cases included.
  await expect(dj.getByRole("row", { name: /Création du dossier/ }).first()).toBeVisible({
    timeout: 30_000,
  });

  // Restricted to system actions, the same type returns nothing: only the scope changed.
  await dj.getByLabel("Portée", { exact: true }).selectOption("HORS_DOSSIER");
  await expect(dj.getByRole("row", { name: /Création du dossier/ })).toHaveCount(0, { timeout: 30_000 });

  await dj.context().close();
});

/**
 * The filter by person is allowed by NF-CONF-01, and it is why consultations must be traced.
 */
test("l'audit filtre par personne, et le dit à qui consulte (Q-112)", async ({ browser }) => {
  const dja = await pageConnectee(browser, "dja.test");
  await ouvrirAudit(dja);

  // The screen states that the consultation is recorded.
  await expect(dja.getByText(/Votre consultation de cet écran est elle-même enregistrée/)).toBeVisible();
  // And it states what it does not cover: consultations are not traced.
  await expect(dja.getByText(/Les consultations ne sont pas tracées/)).toBeVisible();

  // The directory arrives through a separate request: `expect.poll` retries until it is populated.
  const auteur = dja.getByLabel("Auteur", { exact: true });
  await expect.poll(() => auteur.locator("option").count(), { timeout: 30_000 }).toBeGreaterThan(1);
  await auteur.selectOption({ index: 1 });
  // The table reloads without error: this checks the request filtered by person.
  await expect(filtres(dja).getByRole("alert")).toHaveCount(0);

  await dja.context().close();
});

/**
 * The consultation trace protects the DJ and the DJA as much as the people they look up: it shows
 * they only looked at what they had to.
 */
test("consulter l'audit y laisse sa propre trace (Q-112)", async ({ browser }) => {
  const dj = await pageConnectee(browser, "dj.test");
  await ouvrirAudit(dj);

  // Select by value, not label: the code is language-independent and immune to apostrophe style.
  await dj.getByLabel("Action", { exact: true }).selectOption("AUDIT_CONSULTE");
  const ligne = dj.getByRole("row", { name: /Consultation de l/ }).first();
  await expect(ligne).toBeVisible({ timeout: 30_000 });
  // The criteria used appear in the trace, with translated keys ("Portée"), not raw ones.
  await expect(ligne).toContainText(/Portée/);

  await dj.context().close();
});

test("une portée « un dossier » sans numéro est expliquée, pas renvoyée en erreur technique (Q-112)", async ({
  browser,
}) => {
  const dj = await pageConnectee(browser, "dj.test");
  await ouvrirAudit(dj);

  await dj.getByLabel("Portée", { exact: true }).selectOption("UN_DOSSIER");
  await expect(filtres(dj).getByRole("alert")).toContainText("numéro du dossier");

  await dj.getByLabel("N° de dossier", { exact: true }).fill("1");
  await expect(filtres(dj).getByRole("alert")).toHaveCount(0);

  await dj.getByLabel("Du", { exact: true }).fill("2026-12-31");
  await dj.getByLabel("Au", { exact: true }).fill("2026-01-01");
  await expect(filtres(dj).getByRole("alert")).toContainText("date de début est postérieure");

  await dj.context().close();
});

test("l'audit est fermé au juriste, à l'Assistante et au SH (Q-112)", async ({ browser }) => {
  for (const profil of ["juriste.test", "assistante.test", "sh.test"]) {
    const page = await pageConnectee(browser, profil);
    // Not in the navigation...
    await expect(
      page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Audit" }),
    ).toHaveCount(0);
    // ...nor through a forced URL: hiding is not securing.
    await page.goto("/admin/audit");
    await expect(page).toHaveURL(/\/unauthorized/, { timeout: 30_000 });
    await page.context().close();
  }
});

/**
 * "Who set this?" is answered on the settings screen itself, on the row of each setting.
 */
test("l'écran des paramètres porte l'auteur de la dernière modification (Q-112)", async ({
  browser,
}) => {
  const dja = await pageConnectee(browser, "dja.test");
  await dja.goto("/admin/configurations");
  await expect(dja.getByRole("heading", { name: "Paramètres système", level: 1 })).toBeVisible({
    timeout: 60_000,
  });

  // The log is no longer on this screen.
  await expect(dja.getByRole("heading", { name: "Journal des actions système" })).toHaveCount(0);

  const article = dja.locator("article", { hasText: "SEUIL_PROROGATIONS" });
  const champ = article.locator("#configuration-SEUIL_PROROGATIONS");
  const initiale = (await champ.inputValue()).trim();
  const nouvelle = initiale === "12" ? "13" : "12";

  try {
    await champ.fill(nouvelle);
    await article.getByRole("button", { name: "Enregistrer" }).click();
    await expect(dja.getByText("Paramètre SEUIL_PROROGATIONS enregistré.")).toBeVisible();
    // Without clicking: the row shows who just changed it.
    await expect(article).toContainText(/Modifiée le .* par /, { timeout: 30_000 });
  } finally {
    await champ.fill(initiale);
    await article.getByRole("button", { name: "Enregistrer" }).click();
    await expect(dja.getByText("Paramètre SEUIL_PROROGATIONS enregistré.")).toBeVisible();
    await dja.context().close();
  }
});

/**
 * The Action column and the detail keys are translated, through the type code set on each row.
 */
test("en anglais, la nature de l'action et les cles de details sont traduites (QF-24)", async ({
  browser,
}) => {
  const page = await pageConnectee(browser, "dj.test");

  /*
   * Log in, then switch language. The language lives in a cookie set by the selector, not in the
   * browser locale, and switching before login would translate the form `seConnecter` expects in French.
   */
  await page.getByRole("button", { name: "en", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.goto("/admin/audit");
  await expect(page.getByRole("heading", { name: "Audit", level: 1 })).toBeVisible({ timeout: 60_000 });

  const action = page.getByLabel("Action", { exact: true });
  await expect.poll(() => action.locator("option").count(), { timeout: 30_000 }).toBeGreaterThan(1);
  // The filter itself is translated.
  await action.selectOption("CONFIGURATION_MODIFIEE");

  const ligne = page.getByRole("row", { name: /Setting changed/ }).first();
  await expect(ligne).toBeVisible({ timeout: 30_000 });
  // And the detail keys.
  await expect(ligne).toContainText(/Setting/);
  await expect(ligne).toContainText(/Previous value/);
  // No French backend label left.
  await expect(page.getByText("Modification de la configuration")).toHaveCount(0);

  await page.context().close();
});

/**
 * Audit export. Checks the chain that makes the archive enforceable, not the file layout: the file
 * is downloaded, its fingerprint reaches the screen, and the archive is listed with the same fingerprint.
 */
test("une extraction produit un fichier et une archive scellee (Q-113)", async ({ browser }) => {
  const dj = await pageConnectee(browser, "dj.test");
  await ouvrirAudit(dj);

  const extraction = dj.getByRole("region", { name: "Extraire l’audit" });
  await expect(extraction).toBeVisible();

  // Without a period, the export is rejected on screen rather than by a backend 400.
  await expect(extraction.getByRole("alert")).toContainText("Choisissez une période");
  await expect(dj.getByRole("button", { name: "Extraire en PDF" })).toBeDisabled();

  // A shortcut pre-fills the period; it does not start an export.
  await extraction.getByRole("button", { name: "Ce mois-ci" }).click();
  await expect(dj.getByLabel("Du", { exact: true })).not.toHaveValue("");
  await expect(dj.getByLabel("Au", { exact: true })).not.toHaveValue("");
  await expect(extraction.getByRole("alert")).toHaveCount(0);

  const telechargement = dj.waitForEvent("download", { timeout: 60_000 });
  await dj.getByRole("button", { name: "Extraire en PDF" }).click();
  const fichier = await telechargement;
  /*
   * The file name contains the archive reference ("aud-2026-0042-du-au.pdf"): it is cited in
   * transmission letters, so it must be stable.
   */
  expect(fichier.suggestedFilename()).toMatch(
    /^aud-\d{4}-\d{4}-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.pdf$/,
  );
  const reference = fichier.suggestedFilename().slice(0, 13).toUpperCase();

  /*
   * The fingerprint characters themselves must reach the screen, not just the label (the header
   * must be exposed through CORS).
   */
  await expect(dj.getByText(/Extraction produite et scellée \(empreinte [0-9a-f]{12}…\)/)).toBeVisible({
    timeout: 30_000,
  });

  /*
   * The archive appears in the list without refresh. It is identified by its reference, read from
   * the file name, not as "the first in the list": a parallel worker may export at the same time.
   */
  const archives = extraction.getByRole("listitem").filter({ hasText: reference });
  await expect(archives).toBeVisible({ timeout: 30_000 });
  await expect(archives).toContainText(/PDF/);
  // The fingerprint is grouped in blocks of eight for visual comparison.
  await expect(archives.locator("code")).toHaveText(/^([0-9a-f]{8} ){3}[0-9a-f]{8}/);

  await dj.context().close();
});

/** Excel serves a different purpose than PDF: both must be offered and work. */
test("l'extraction Excel produit un classeur (Q-113)", async ({ browser }) => {
  const dja = await pageConnectee(browser, "dja.test");
  await ouvrirAudit(dja);

  const extraction = dja.getByRole("region", { name: "Extraire l’audit" });
  await extraction.getByRole("button", { name: "Aujourd’hui" }).click();

  const telechargement = dja.waitForEvent("download", { timeout: 60_000 });
  await dja.getByRole("button", { name: "Extraire en Excel" }).click();
  const fichier = await telechargement;
  expect(fichier.suggestedFilename()).toMatch(/\.xlsx$/);

  await dja.context().close();
});

/**
 * Retrieve an existing archive. It goes through the application, the only place where retrieval is
 * traced, and not through the storage key, which the API does not expose.
 */
test("recuperer une archive laisse une trace (Q-113)", async ({ browser }) => {
  const dj = await pageConnectee(browser, "dj.test");
  await ouvrirAudit(dj);

  const extraction = dj.getByRole("region", { name: "Extraire l’audit" });
  const premiere = extraction.getByRole("listitem").first();
  await expect(premiere).toBeVisible({ timeout: 30_000 });

  const onglet = dj.context().waitForEvent("page", { timeout: 60_000 });
  await premiere.getByRole("button", { name: "Récupérer" }).click();
  await (await onglet).close();

  // The trace appears in the audit itself.
  await dj.getByLabel("Action", { exact: true }).selectOption("ARCHIVE_TELECHARGEE");
  await expect(dj.getByRole("row", { name: /archive/ }).first()).toBeVisible({ timeout: 30_000 });

  await dj.context().close();
});

/**
 * Verification of a received file: a file produced here is recognized here.
 */
test("un fichier extrait est reconnu par le vérificateur (Q-114)", async ({ browser }, infos) => {
  const dj = await pageConnectee(browser, "dj.test");
  await ouvrirAudit(dj);

  const extraction = dj.getByRole("region", { name: "Extraire l’audit" });
  await extraction.getByRole("button", { name: "Ce mois-ci" }).click();

  const telechargement = dj.waitForEvent("download", { timeout: 60_000 });
  await dj.getByRole("button", { name: "Extraire en PDF" }).click();
  const fichier = await telechargement;
  const chemin = infos.outputPath(fichier.suggestedFilename());
  await fichier.saveAs(chemin);

  // The reference in the file name is the archive reference: one can be found from the other.
  const reference = fichier.suggestedFilename().slice(0, 13).toUpperCase();
  expect(reference).toMatch(/^AUD-\d{4}-\d{4}$/);

  const verificateur = dj.getByRole("region", { name: "Vérifier un fichier" });
  await expect(verificateur).toBeVisible();
  await verificateur.locator("#verifier-fichier").setInputFiles(chemin);

  // Recognized and named.
  const reponse = verificateur.getByRole("status");
  await expect(reponse).toContainText("Fichier reconnu", { timeout: 60_000 });
  await expect(reponse).toContainText(reference);
  // The scope is stated: the application does not claim to prove more than it can.
  await expect(reponse).toContainText(/antériorité face à un tiers/);
  // The fingerprint computed locally is shown, grouped.
  await expect(reponse.locator("code")).toHaveText(/^([0-9a-f]{8} ){3}[0-9a-f]{8}/);

  await dj.context().close();
});

/**
 * An unknown file is an answer, not an error: "I do not recognize this document" and "verification
 * failed" lead to very different follow-ups.
 */
test("un fichier qui n'est pas une archive reçoit une réponse, pas une erreur (Q-114)", async ({
  browser,
}, infos) => {
  const dja = await pageConnectee(browser, "dja.test");
  await ouvrirAudit(dja);

  const chemin = infos.outputPath("document-quelconque.pdf");
  await writeFile(chemin, "Ceci n'a jamais ete scelle ici.");

  const verificateur = dja.getByRole("region", { name: "Vérifier un fichier" });
  await verificateur.locator("#verifier-fichier").setInputFiles(chemin);

  const reponse = verificateur.getByRole("status");
  await expect(reponse).toContainText("Aucune archive ne correspond", { timeout: 60_000 });
  // The computed fingerprint stays displayed: this is exactly when it is needed.
  await expect(reponse.locator("code")).toHaveText(/^([0-9a-f]{8} ){3}[0-9a-f]{8}/);
  // Not shown as an error.
  await expect(verificateur.getByRole("alert")).toHaveCount(0);

  await dja.context().close();
});
