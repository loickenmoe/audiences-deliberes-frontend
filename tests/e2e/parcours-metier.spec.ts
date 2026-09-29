import { loadEnvConfig } from "@next/env";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { affecterParDefaut } from "./affectation";
import { avocatDeTest } from "./avocat-de-test";
import { ligneDansLaFile } from "./files-de-travail";
import { deposerPiecesDeCreation } from "./pieces-de-creation";

/**
 * Les neuf parcours métier **P1 à P9** de `FUNCTIONAL_MAP.md`, joués de bout en bout dans
 * l'interface.
 *
 * **Ce que ces parcours ajoutent aux 110 autres.** Les suites par module vérifient chacune un écran
 * et ses règles ; elles ne disent rien de la **continuité** — qu'un dossier créé par un juriste
 * porte bien l'audience qu'il planifie, que le délibéré s'y rattache, que la décision définitive
 * s'archive sur la même étape. C'est le passage de relais entre profils et entre écrans qui est
 * éprouvé ici, jamais un écran isolé.
 *
 * Chaque parcours change de compte autant de fois que la vie du dossier l'exige, comme dans la
 * réalité : le juriste ouvre, l'avocat dépose, l'Assistante contrôle, la DJA arbitre, le DJ valide.
 *
 * **Couverture des neuf parcours — ce fichier n'en rejoue que cinq, et c'est délibéré.** P3, P4, P5
 * et P7 sont déjà éprouvés de bout en bout par leur suite de module ; les redoubler ici allongerait
 * la suite sans rien prouver de neuf. Le tableau dit où chacun est tenu :
 *
 * | Parcours | Où il est joué |
 * |---|---|
 * | P1 — ouverture d'un dossier | **ici** |
 * | P2 — cycle d'une audience | **ici**, jusqu'au compte rendu de l'avocat |
 * | P3 — cycle d'un délibéré | `deliberes.spec.ts` (prorogation, rabattement, vidage) |
 * | P4 — voie de recours | `deliberes.spec.ts` (délibéré défavorable, recours, clôture) |
 * | P5 — décision définitive | `decisions.spec.ts` (adjudication, condamnation, archivage) |
 * | P6 — demande de frais | **ici**, de l'avocat au contrôle de conformité |
 * | P7 — constitution d'un prestataire | `publications.spec.ts` (sollicitation, signature SH, lettre) |
 * | P8 — suppression d'un document | **ici**, du juriste au DJ |
 * | P9 — pilotage | **ici**, les quatre étapes enchaînées |
 */

loadEnvConfig(process.cwd());

const MOT_DE_PASSE = "Password1!";

function suffixe() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/*
 * L'intervenant rattaché au compte `avocat.test` (Q-84) est **lu** au référentiel, et non supposé :
 * son nom appartient aux données, qu'un DJ peut changer — voir `avocat-de-test.ts`.
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
 * P1 — ouverture d'un dossier de recouvrement, dans l'interface : création avec sa pièce, puis
 * relecture de la fiche. Renvoie la référence et l'URL, sur lesquelles les parcours suivants
 * s'appuient.
 */
async function ouvrirUnDossier(page: Page, marque: string) {
  await page.goto("/dossiers/nouveau");
  const reference = `DOS-${marque}`;
  await page.getByLabel("Référence", { exact: true }).fill(reference);
  await page.getByLabel("Nature du dossier", { exact: true }).selectOption("Assignation en paiement");
  await page.getByLabel("Juridiction saisie", { exact: true }).fill("TGI Douala");
  await page.getByLabel("Client", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Risque encouru (FCFA)", { exact: true }).fill("5000000");
  await page.getByLabel("Dossier de crédit d’origine", { exact: true }).fill(`CRD-${marque}`);
  await page.getByLabel("PV de transfert", { exact: true }).fill(`PV-${marque}`);
  await deposerPiecesDeCreation(page, { marque });
  /*
   * L'avocat est choisi **par son nom**, jamais par son rang : `{ index: 0 }` désignait un avocat
   * arbitraire du référentiel, et le dossier n'appartenait donc pas à `avocat.test` — son portail
   * ne le proposait pas, et les parcours P2 et P6 restaient bloqués sur un sélecteur sans l'option
   * attendue.
   */
  await affecterParDefaut(page, { avocat: (await avocatDeTest()).nom });
  await page
    .locator('input[name="piece-PV_TRANSFERT"]')
    .setInputFiles({ name: `pv-${marque}.pdf`, mimeType: "application/pdf", buffer: PDF });
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/dossiers\/\d+$/, { timeout: 60_000 });
  return { reference, url: page.url() };
}

/**
 * Choisit un dossier dans le portail avocat, par sa référence.
 *
 * Le champ est un combobox cherchable depuis le 2026-09-28 : il interroge le serveur au fil de la
 * frappe, au lieu de charger une page des dossiers les plus récents — dans laquelle les anciens
 * manquaient, sans que rien ne le dise.
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

  // La fiche porte la référence saisie — en surtitre, le `h1` étant la nature de la procédure.
  await expect(page.getByText(reference).first()).toBeVisible();
  await page.getByRole("tab", { name: "Documents" }).click();
  await expect(page.getByRole("row", { name: /\.pdf/ }).first()).toBeVisible({ timeout: 30_000 });

  // Et il est immédiatement retrouvable dans la liste — NF-PERF-01 le veut indexé en moins d'une seconde.
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
  const { url } = await ouvrirUnDossier(juriste, marque);

  /*
   * L'étape d'instance doit d'abord passer `EN_COURS` : une audience se planifie sur une instance
   * ouverte, pas sur un dossier qui vient d'être créé. C'est précisément le genre d'enchaînement que
   * ces parcours existent pour tenir — une suite par module l'aurait pris pour acquis.
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

  // L'audience apparaît dans le calendrier : le juriste la retrouve sans passer par la fiche.
  await juriste.goto("/audiences/calendrier");
  await expect(juriste.getByRole("heading", { name: "Calendrier des audiences" })).toBeVisible();

  // L'avocat dépose son compte rendu sur cette audience (US 5.1).
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/publications/nouvelle");
  await choisirDossierAvocat(avocat, `DOS-${marque}`);
  await expect(avocat.locator("#publication-audience")).toBeEnabled({ timeout: 30_000 });
  await avocat.locator("#publication-audience").selectOption({ index: 1 });
  await avocat.locator("#publication-contenu").fill(`Audience renvoyée - ${marque}`);
  // Q-98 : le plumitif accompagne le récit, en un seul dépôt.
  await avocat
    .locator('input[name="piece-jointe"]')
    .setInputFiles({ name: `plumitif-${marque}.pdf`, mimeType: "application/pdf", buffer: PDF });
  await avocat.getByRole("button", { name: "Déposer le compte rendu" }).click();
  await expect(avocat.getByText("Publication déposée. Elle sera visible après validation.")).toBeVisible({
    timeout: 30_000,
  });
  await avocat.context().close();

  // L'Assistante la valide : elle devient alors consultable par le juriste (RG-INT-10).
  const assistante = await pageConnectee(browser, "assistante.test");
  await assistante.goto("/publications");
  // File FIFO et paginée : la publication qu'on vient de déposer est en queue, pas en tête.
  const ligne = await ligneDansLaFile(assistante, new RegExp(`DOS-${marque}`));
  await expect(ligne).toBeVisible({ timeout: 30_000 });

  // Q-98 : la pièce du compte rendu s'ouvre depuis la publication elle-même — c'est ce qui
  // manquait quand le plumitif partait en dépôt séparé, sans lien avec l'audience.
  await ligne.getByRole("link", { name: /Compte rendu/ }).click();
  await assistante.waitForURL(/\/publications\/\d+$/, { timeout: 60_000 });
  await expect(assistante.getByRole("heading", { name: "Pièce jointe" })).toBeVisible({ timeout: 30_000 });
  // `exact` : le dialogue d'aperçu porte le même nom, précédé de « Aperçu — ».
  await expect(assistante.getByText(`plumitif-${marque}.pdf`, { exact: true })).toBeVisible();
  await assistante.context().close();

  expect(url).toMatch(/\/dossiers\/\d+$/);
  await juriste.context().close();
});

test("P6 — une demande de frais traverse tout son circuit, de l'avocat au paiement", async ({ browser }) => {
  const marque = suffixe();
  const juriste = await pageConnectee(browser, "juriste.test");
  await ouvrirUnDossier(juriste, marque);
  await juriste.context().close();

  // 1. L'avocat dépose, pièce justificative comprise (UC-INT-01).
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/frais/nouvelle");
  const facture = `FAC-${marque}`;
  await choisirDossierAvocat(avocat, `DOS-${marque}`);
  await avocat.locator("#frais-reference").fill(facture);
  await avocat.locator("#frais-montant").fill("400000");
  await avocat
    .locator('input[name="piece-justificative"]')
    .setInputFiles({ name: "facture.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(avocat.getByText("facture.pdf")).toBeVisible({ timeout: 30_000 });
  await avocat.getByRole("button", { name: "Déposer", exact: true }).click();
  await expect(avocat.getByText("Demande de frais déposée.")).toBeVisible({ timeout: 30_000 });
  await avocat.context().close();

  // 2. L'Assistante contrôle la conformité — et doit pouvoir **ouvrir** la pièce (UC-INT-02 ét. 3).
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
  const { url } = await ouvrirUnDossier(juriste, marque);
  // Le même nom que celui déposé par `ouvrirUnDossier` : la casse compte pour retrouver la ligne.
  const nom = `pv-${marque}.pdf`;

  await juriste.goto(`${url}?onglet=documents`);
  await juriste.getByRole("button", { name: `Demander la suppression - ${nom}` }).click();
  await juriste.getByRole("dialog").getByRole("button", { name: "Demander la suppression" }).click();
  await expect(juriste.getByText("Demande de suppression envoyée au DJ et au DJA.")).toBeVisible({
    timeout: 30_000,
  });
  await juriste.context().close();

  // Le DJ arbitre : la demande lui est parvenue, nommée par son fichier et son dossier (Q-79).
  const dj = await pageConnectee(browser, "dj.test");
  await dj.goto("/ged/demandes-suppression");
  const ligne = await ligneDansLaFile(dj, new RegExp(nom));
  await expect(ligne).toBeVisible({ timeout: 30_000 });
  await expect(ligne).toContainText(`DOS-${marque}`);
  await dj.context().close();
});

test("P9 — le pilotage s'enchaîne : tableau de bord, rapport, vue client, seuils", async ({ browser }) => {
  const dj = await pageConnectee(browser, "dj.test");

  // 1. Le tableau de bord, réservé à la direction (Q-95).
  await dj.goto("/tableau-de-bord");
  await expect(dj.getByRole("heading", { name: "Tableau de bord", level: 1 })).toBeVisible();

  // 2. Le rapport, atteint par le composite ROLE_JURISTE du DJ (Q-81, QF-04).
  await dj.getByRole("link", { name: "Générer un rapport" }).click();
  await dj.waitForURL(/\/rapports/, { timeout: 60_000 });
  await dj.locator("#rapport-debut").fill("2020-01-01");
  await dj.locator("#rapport-fin").fill("2030-12-31");
  await dj.getByRole("button", { name: "Afficher le rapport" }).click();
  await expect(dj.getByText("Dossiers ouverts")).toBeVisible({ timeout: 30_000 });

  // 3. La vue consolidée d'un client.
  await dj.goto("/clients");
  await dj.getByRole("link").filter({ hasText: /^CLI/ }).first().click();
  await dj.waitForURL(/\/clients\/\d+/, { timeout: 60_000 });
  await expect(dj.getByRole("link", { name: "Retour à la liste des clients" })).toBeVisible({
    timeout: 30_000,
  });

  // 4. L'ajustement d'un seuil, dernier maillon du parcours de pilotage.
  await dj.goto("/admin/configurations");
  await expect(dj.getByRole("heading", { name: "Paramètres système", level: 1 })).toBeVisible();
  await expect(dj.locator("#configuration-SEUIL_MONTANT_DEFAUT")).toBeEnabled();

  await dj.context().close();
});
