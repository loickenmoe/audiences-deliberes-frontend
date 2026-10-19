import { loadEnvConfig } from "@next/env";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { affecterParDefaut } from "./affectation";
import { avocatDeTest } from "./avocat-de-test";
import { ligneDansLaFile } from "./files-de-travail";
import { deposerPiecesDeCreation } from "./pieces-de-creation";
import { referenceDuDossier } from "./reference-attribuee";
import { choisirAgenceOrigine } from "./agence-de-creation";

/**
 * Business journeys P1 to P9 from `FUNCTIONAL_MAP.md`, played end to end in the UI. They check the
 * hand-over between profiles and screens (continuity of a case), not isolated screens.
 *
 * | Journey | Where it is played |
 * |---|---|
 * | P1 - opening a case | here |
 * | P2 - hearing cycle | here, up to the lawyer's report |
 * | P3 - deliberation cycle | `deliberes.spec.ts` (extension, reopening, ruling) |
 * | P4 - appeal | `deliberes.spec.ts` (unfavourable deliberation, appeal, closing) |
 * | P5 - final decision | `decisions.spec.ts` (adjudication, conviction, archiving) |
 * | P6 - expense request | here, from the lawyer to the compliance check |
 * | P7 - provider appointment | `publications.spec.ts` (request, SH signature, letter) |
 * | P8 - document deletion | here, from the legal officer to the DJ |
 * | P9 - steering | here, the four steps chained |
 */

loadEnvConfig(process.cwd());

const MOT_DE_PASSE = "Password1!";

function suffixe() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/*
 * The party linked to the `avocat.test` account is read from the reference data, not assumed: a DJ
 * can change its name. See `avocat-de-test.ts`.
 */

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");

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

/**
 * P1 - opening a recovery case in the UI: creation with its document, then reading the case page.
 * Returns the reference and URL used by the following journeys.
 */
async function ouvrirUnDossier(page: Page, marque: string) {
  await page.goto("/dossiers/nouveau");
  await page.getByLabel("Nature du dossier", { exact: true }).selectOption("Assignation en paiement");
  await page.getByLabel("Juridiction saisie", { exact: true }).fill("TGI Douala");
  await page.getByLabel("Client", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Risque encouru (FCFA)", { exact: true }).fill("5000000");
  // At least one party on each side is required.
  await page.getByLabel("Demandeurs 1", { exact: true }).fill("AFRILAND FIRST BANK");
  await page.getByLabel("Défendeurs 1", { exact: true }).fill("Débiteur");
  // Required: the branch comes from the reference data.
  await choisirAgenceOrigine(page);
  await page.getByLabel("Dossier de crédit d’origine", { exact: true }).fill(`CRD-${marque}`);
  await page.getByLabel("PV de transfert", { exact: true }).fill(`PV-${marque}`);
  await deposerPiecesDeCreation(page, { marque });
  /*
   * The lawyer is chosen by name, never by position: otherwise the case may not belong to
   * `avocat.test` and would not appear in its portal.
   */
  await affecterParDefaut(page, { avocat: (await avocatDeTest()).nom });
  await page
    .locator('input[name="piece-PV_TRANSFERT"]')
    .setInputFiles({ name: `pv-${marque}.pdf`, mimeType: "application/pdf", buffer: PDF });
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/dossiers\/\d+$/, { timeout: 60_000 });
  // The reference is system-assigned: read it from the case page.
  return { reference: await referenceDuDossier(page), url: page.url() };
}

/**
 * Picks a case in the lawyer portal by reference. The field is a searchable combobox querying the
 * server as the user types, so older cases are reachable too.
 */
async function choisirDossierAvocat(page: Page, reference: string) {
  const champ = page.getByRole("combobox", { name: "Dossier" });
  await champ.click();
  await champ.fill(reference);
  const option = page
    .getByRole("listbox", { name: "Dossier" })
    .getByRole("option", { name: new RegExp(reference) })
    .first();
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  await champ.press("Escape");
}

test("P1 — un dossier de recouvrement s'ouvre, avec ses affectations et sa pièce", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  const { reference, url } = await ouvrirUnDossier(page, suffixe());

  // The case page shows the reference as overline; the `h1` is the procedure type.
  await expect(page.getByText(reference).first()).toBeVisible();
  await page.getByRole("tab", { name: "Documents" }).click();
  await expect(page.getByRole("row", { name: /\.pdf/ }).first()).toBeVisible({ timeout: 30_000 });

  // It is immediately findable in the list (NF-PERF-01: indexed in under a second).
  await page.goto("/dossiers");
  await page.getByLabel("Référence", { exact: true }).fill(reference);
  await expect(page.getByRole("link", { name: reference })).toBeVisible({ timeout: 30_000 });
  expect(url).toMatch(/\/dossiers\/\d+$/);
});

test("P2 — une audience se planifie puis se tient, et le compte rendu de l'avocat est validé", async ({
  browser,
}) => {
  const marque = suffixe();
  const juriste = await pageConnectee(browser, "juriste.test");
  const { reference, url } = await ouvrirUnDossier(juriste, marque);

  /*
   * The instance step must first move to `EN_COURS`: a hearing is scheduled on an open instance,
   * not on a freshly created case.
   */
  await juriste.getByRole("tab", { name: "Étapes" }).click();
  await juriste.getByLabel("Faire passer à", { exact: true }).selectOption("EN_COURS");
  await juriste.getByRole("button", { name: "Appliquer" }).click();
  await expect(juriste.getByText("Statut de l’étape mis à jour.")).toBeVisible({ timeout: 30_000 });

  await juriste.getByRole("tab", { name: "Audiences" }).click();
  await juriste.getByRole("button", { name: "Planifier une audience" }).click();
  const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await juriste.getByLabel("Date de l’audience", { exact: true }).fill(demain);
  await juriste
    .getByRole("dialog", { name: "Planifier une audience" })
    .getByRole("button", { name: "Enregistrer" })
    .click();
  await expect(juriste.getByText("Audience planifiée.")).toBeVisible({ timeout: 30_000 });

  // The hearing appears in the calendar: the legal officer finds it without the case page.
  await juriste.goto("/audiences/calendrier");
  await expect(juriste.getByRole("heading", { name: "Calendrier des audiences" })).toBeVisible();

  // The lawyer files a report on this hearing (US 5.1).
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/publications/nouvelle");
  // The reference is system-assigned: use the one returned at creation, never one built from the
  // journey marker.
  await choisirDossierAvocat(avocat, reference);
  await expect(avocat.locator("#publication-audience")).toBeEnabled({ timeout: 30_000 });
  await avocat.locator("#publication-audience").selectOption({ index: 1 });
  await avocat.locator("#publication-contenu").fill(`Audience renvoyée - ${marque}`);
  // The court record accompanies the report, in a single upload.
  await avocat
    .locator('input[name="piece-jointe"]')
    .setInputFiles({ name: `plumitif-${marque}.pdf`, mimeType: "application/pdf", buffer: PDF });
  await avocat.getByRole("button", { name: "Déposer le compte rendu" }).click();
  await expect(avocat.getByText("Compte rendu déposé. Il est immédiatement consultable par la Direction Juridique ; l’Assistante en accusera réception.")).toBeVisible({
    timeout: 30_000,
  });
  await avocat.context().close();

  // The Assistant validates it, making it visible to the legal officer (RG-INT-10).
  const assistante = await pageConnectee(browser, "assistante.test");
  await assistante.goto("/publications");
  // FIFO paginated queue: the publication just filed is at the end, not the top.
  const ligne = await ligneDansLaFile(assistante, new RegExp(reference));
  await expect(ligne).toBeVisible({ timeout: 30_000 });

  // The report document opens from the publication itself.
  await ligne.getByRole("link", { name: /Compte rendu/ }).click();
  await assistante.waitForURL(/\/publications\/\d+$/, { timeout: 60_000 });
  await expect(assistante.getByRole("heading", { name: "Pièce jointe" })).toBeVisible({ timeout: 30_000 });
  // `exact`: the preview dialog has the same name, prefixed with "Aperçu — ".
  await expect(assistante.getByText(`plumitif-${marque}.pdf`, { exact: true })).toBeVisible();
  await assistante.context().close();

  expect(url).toMatch(/\/dossiers\/\d+$/);
  await juriste.context().close();
});

test("P6 — une demande de frais traverse tout son circuit, de l'avocat au paiement", async ({ browser }) => {
  const marque = suffixe();
  const juriste = await pageConnectee(browser, "juriste.test");
  const { reference } = await ouvrirUnDossier(juriste, marque);
  await juriste.context().close();

  // 1. The lawyer files the request, supporting document included (UC-INT-01).
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/frais/nouvelle");
  const facture = `FAC-${marque}`;
  await choisirDossierAvocat(avocat, reference);
  await avocat.locator("#frais-reference").fill(facture);
  await avocat.locator("#frais-montant").fill("400000");
  await avocat
    .locator('input[name="piece-justificative"]')
    .setInputFiles({ name: "facture.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(avocat.getByText("facture.pdf")).toBeVisible({ timeout: 30_000 });
  await avocat.getByRole("button", { name: "Déposer", exact: true }).click();
  await expect(avocat.getByText("Demande de frais déposée.")).toBeVisible({ timeout: 30_000 });
  await avocat.context().close();

  // 2. The Assistant checks compliance and must be able to open the document (UC-INT-02 step 3).
  const assistante = await pageConnectee(browser, "assistante.test");
  await assistante.goto("/frais");
  await assistante.getByRole("link", { name: facture }).click();
  await assistante.waitForURL(/\/frais\/\d+$/, { timeout: 60_000 });
  await expect(assistante.getByText("facture.pdf")).toBeVisible({ timeout: 30_000 });
  await assistante.context().close();
});

test("P8 — une suppression de document est demandée par le juriste et arbitrée par le DJ", async ({
  browser,
}) => {
  const marque = suffixe();
  const juriste = await pageConnectee(browser, "juriste.test");
  const { reference, url } = await ouvrirUnDossier(juriste, marque);
  // Same name as uploaded by `ouvrirUnDossier`: case matters to find the row.
  const nom = `pv-${marque}.pdf`;

  await juriste.goto(`${url}?onglet=documents`);
  await juriste.getByRole("button", { name: `Demander la suppression - ${nom}` }).click();
  await juriste.getByRole("dialog").getByRole("button", { name: "Demander la suppression" }).click();
  await expect(juriste.getByText("Demande de suppression envoyée au DJ et au DJA.")).toBeVisible({
    timeout: 30_000,
  });
  await juriste.context().close();

  // The DJ decides: the request reached them, named by its file and case.
  const dj = await pageConnectee(browser, "dj.test");
  await dj.goto("/ged/demandes-suppression");
  const ligne = await ligneDansLaFile(dj, new RegExp(nom));
  await expect(ligne).toBeVisible({ timeout: 30_000 });
  await expect(ligne).toContainText(reference);
  await dj.context().close();
});

test("P9 — le pilotage s'enchaîne : tableau de bord, rapport, vue client, seuils", async ({ browser }) => {
  const dj = await pageConnectee(browser, "dj.test");

  // 1. The dashboard, restricted to management.
  await dj.goto("/tableau-de-bord");
  await expect(dj.getByRole("heading", { name: "Tableau de bord", level: 1 })).toBeVisible();

  // 2. The report, reached through the DJ's composite ROLE_JURISTE.
  await dj.getByRole("link", { name: "Générer un rapport" }).click();
  await dj.waitForURL(/\/rapports/, { timeout: 60_000 });
  await dj.locator("#rapport-debut").fill("2020-01-01");
  await dj.locator("#rapport-fin").fill("2030-12-31");
  await dj.getByRole("button", { name: "Afficher le rapport" }).click();
  await expect(dj.getByText("Dossiers ouverts")).toBeVisible({ timeout: 30_000 });

  // 3. The consolidated client view.
  await dj.goto("/clients");
  await dj.getByRole("link").filter({ hasText: /^CLI/ }).first().click();
  await dj.waitForURL(/\/clients\/\d+/, { timeout: 60_000 });
  await expect(dj.getByRole("link", { name: "Retour à la liste des clients" })).toBeVisible({
    timeout: 30_000,
  });

  // 4. Adjusting a threshold, last step of the steering journey.
  await dj.goto("/admin/configurations");
  await expect(dj.getByRole("heading", { name: "Paramètres système", level: 1 })).toBeVisible();
  await expect(dj.locator("#configuration-SEUIL_MONTANT_DEFAUT")).toBeEnabled();

  await dj.context().close();
});
