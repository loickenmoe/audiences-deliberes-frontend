import { expect, test, type Browser, type Page } from "@playwright/test";
import { affecterParDefaut } from "./affectation";
import { deposerPiecesDeCreation } from "./pieces-de-creation";
import { referenceDuDossier } from "./reference-attribuee";
import { choisirAgenceOrigine } from "./agence-de-creation";

/**
 * Case page flows (screens 07, 08, 15, 16, 18) against the real backend. Each test creates its own
 * case through the UI; creation redirects to the case page.
 */

const MOT_DE_PASSE = "Password1!";
const NATURE = "Assignation en paiement";

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


/** Creates a case through the UI and returns its page URL. */
async function creerDossier(page: Page, { sensible = false } = {}) {
  await page.goto("/dossiers/nouveau");
  await page.getByLabel("Nature du dossier", { exact: true }).selectOption(NATURE);
  await page.getByLabel("Juridiction saisie", { exact: true }).fill("TGI Douala");
  await page.getByLabel("Client", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Risque encouru (FCFA)", { exact: true }).fill("5000000");
  // Mandatory: at least one party on each side.
  await page.getByLabel("Demandeurs 1", { exact: true }).fill("AFRILAND FIRST BANK");
  await page.getByLabel("Défendeurs 1", { exact: true }).fill("Débiteur");
  // Mandatory: the branch comes from the reference data.
  await choisirAgenceOrigine(page);
  await page.getByLabel("Dossier de crédit d’origine", { exact: true }).fill("CRD-FICHE");
  await page.getByLabel("PV de transfert", { exact: true }).fill("PV-FICHE");
  await deposerPiecesDeCreation(page, { marque: "fiche" });
  await affecterParDefaut(page);
  if (sensible) {
    await page.getByLabel("Dossier à diligence particulière", { exact: true }).check();
    await page.getByLabel("Seuil proposé (FCFA)", { exact: true }).fill("60000000");
    await page.getByLabel("Type de client", { exact: true }).selectOption("VIP");
  }
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/dossiers\/\d+$/, { timeout: 60_000 });
  // The reference is assigned by the system: read it from the case page.
  return { url: page.url(), reference: await referenceDuDossier(page) };
}

test("la création mène à la fiche, qui présente le dossier créé", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  const { reference } = await creerDossier(page);

  await expect(page.getByText(reference, { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: NATURE, level: 1 })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Synthèse" })).toHaveAttribute("aria-selected", "true");
});

test("la liste des dossiers mène à la fiche", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  const { reference } = await creerDossier(page);

  await page.goto(`/dossiers?reference=${reference}`);
  await page.getByRole("link", { name: reference }).click();
  await page.waitForURL(/\/dossiers\/\d+$/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: NATURE, level: 1 })).toBeVisible();
});

test("seules les transitions permises sont proposées, et elles s'appliquent", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await creerDossier(page);

  await page.getByRole("tab", { name: "Étapes" }).click();
  const choix = page.getByLabel("Faire passer à", { exact: true });

  // From OUVERTURE, the backend only accepts EN_COURS: the only option offered.
  await expect(choix.locator("option")).toHaveText(["Choisissez un statut", "En cours"]);

  await choix.selectOption("EN_COURS");
  await page.getByRole("button", { name: "Appliquer" }).click();
  await expect(page.getByText("Statut de l’étape mis à jour.")).toBeVisible();

  // The step is EN_COURS: the only next state is EN_DELIBERE.
  await expect(choix.locator("option")).toHaveText(["Choisissez un statut", "En délibéré"]);
});

test("positionner au pourvoi en cassation annonce puis crée l'appel", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await creerDossier(page);

  await page.getByRole("tab", { name: "Étapes" }).click();
  await page.getByLabel("Choisissez une étape", { exact: true }).selectOption("RECOURS_2");
  await page.getByRole("button", { name: "Positionner" }).click();

  // The backend side effect is announced before confirmation.
  const dialogue = page.getByRole("dialog");
  await expect(dialogue).toContainText("Appel");
  await dialogue.getByRole("button", { name: "Confirmer" }).click();

  await expect(page.getByRole("heading", { name: "Appel" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pourvoi en cassation" })).toBeVisible();
  // The CCJA appeal is still available: the two cassations are concurrent, not successive.
  await expect(page.getByText("Toutes les étapes existent déjà.")).toHaveCount(0);
});

/**
 * Both cassations coexist: the CCJA appeal opens without creating a Supreme Court step, and the
 * case then holds both.
 */
test("un dossier peut être porté devant la Cour Suprême et devant la CCJA", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  const { reference } = await creerDossier(page);

  await page.getByRole("tab", { name: "Étapes" }).click();
  await page.getByLabel("Choisissez une étape", { exact: true }).selectOption("RECOURS_2_CCJA");
  await page.getByRole("button", { name: "Positionner" }).click();

  // The appeal is listed, the Supreme Court is not: it does not precede the CCJA appeal.
  const dialogue = page.getByRole("dialog");
  await expect(dialogue).toContainText("Appel");
  await expect(dialogue).not.toContainText("Pourvoi en cassation");
  await dialogue.getByRole("button", { name: "Confirmer" }).click();

  await expect(page.getByRole("heading", { name: "Pourvoi CCJA" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pourvoi en cassation", exact: true })).toHaveCount(0);

  // The national appeal then opens alongside: the case is before both courts.
  await page.getByLabel("Choisissez une étape", { exact: true }).selectOption("RECOURS_2");
  await page.getByRole("button", { name: "Positionner" }).click();
  const second = page.getByRole("dialog");
  if (await second.isVisible()) {
    await second.getByRole("button", { name: "Confirmer" }).click();
  }
  await expect(page.getByRole("heading", { name: "Pourvoi en cassation", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pourvoi CCJA" })).toBeVisible();
  await expect(page.getByText("Toutes les étapes existent déjà.")).toBeVisible();

  // The case list shows both cassations.
  await page.goto("/dossiers");
  await page.getByLabel("Référence", { exact: true }).fill(reference);
  const ligne = page.getByRole("row", { name: new RegExp(reference) });
  await expect(ligne).toContainText("Pourvoi en cassation");
  await expect(ligne).toContainText("Pourvoi CCJA");
});

test("conserver une affectation demande confirmation (ERR-003), puis l'enregistre", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await creerDossier(page);

  await page.getByRole("button", { name: "Modifier l’affectation" }).click();
  // Validating without changes keeps the assigned people: the backend answers ERR-003.
  await page.getByRole("dialog").getByRole("button", { name: "Enregistrer" }).click();

  const confirmation = page.getByRole("dialog", { name: "Confirmer l’affectation" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Confirmer" }).click();

  await expect(page.getByText("Affectation enregistrée.")).toBeVisible();
});

test("l'historique retrace les actions sur le dossier", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await creerDossier(page);

  await page.getByRole("tab", { name: "Historique" }).click();
  await expect(page.getByText("Création du dossier")).toBeVisible();
});

/**
 * The Documents tab reads the dedicated `GET /dossiers/{id}/documents` endpoint, not the case's
 * `documents` field, which is always empty. A new debt-recovery case holds the credit file and the
 * transfer report filed at creation.
 */
test("l'onglet documents lit la liste dédiée et porte les pièces de la création", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await creerDossier(page);

  await page.getByRole("tab", { name: "Documents" }).click();
  await expect(page.getByText("Aucun document", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("row").filter({ hasText: ".pdf" }).first()).toBeVisible({
    timeout: 30_000,
  });
});

test("sensibilité validée, dérogation demandée, puis arbitrée par le DJ", async ({ browser }) => {
  const juriste = await pageConnectee(browser, "juriste.test");
  const { url } = await creerDossier(juriste, { sensible: true });

  // The legal officer cannot decide on his own proposal.
  await expect(juriste.getByRole("button", { name: "Statuer sur la diligence particulière" })).toHaveCount(0);
  // And the exemption is not admissible yet: sensitivity is not validated.
  await expect(juriste.getByRole("button", { name: "Demander une dérogation" })).toHaveCount(0);

  const dj = await pageConnectee(browser, "dj.test");
  await dj.goto(url);
  await dj.getByRole("button", { name: "Statuer sur la diligence particulière" }).click();
  await dj.getByRole("dialog").getByRole("button", { name: "Valider" }).click();
  await expect(dj.getByText("Décision enregistrée.")).toBeVisible();

  await juriste.reload();
  await expect(juriste.getByRole("button", { name: "Demander une dérogation" })).toBeVisible();

  // The exemption request goes to the DJ...
  await juriste.getByRole("button", { name: "Demander une dérogation" }).click();
  const demande = juriste.getByRole("dialog", { name: "Demander une dérogation de seuil" });
  await demande.getByLabel("Nouveau seuil (FCFA)", { exact: true }).fill("80000000");
  await demande.getByLabel("Motif", { exact: true }).fill("Client stratégique");
  await demande.getByRole("button", { name: "Enregistrer" }).click();
  await expect(juriste.getByText("Demande de dérogation envoyée.")).toBeVisible();

  // ...who can now decide on it.
  await dj.reload();
  await expect(dj.getByRole("heading", { name: "Dérogations de seuil en attente" })).toBeVisible();
  await dj.getByRole("button", { name: "Arbitrer" }).click();
  await dj.getByRole("dialog", { name: "Arbitrer la dérogation de seuil" }).getByRole("button", { name: "Valider" }).click();
  await expect(dj.getByText("Dérogation arbitrée.")).toBeVisible();
  // The queue is empty: the card disappears.
  await expect(dj.getByRole("heading", { name: "Dérogations de seuil en attente" })).toHaveCount(0);

  await juriste.context().close();
  await dj.context().close();
});

test("un rejet de sensibilité exige un motif", async ({ browser }) => {
  const juriste = await pageConnectee(browser, "juriste.test");
  const { url } = await creerDossier(juriste, { sensible: true });
  await juriste.context().close();

  const dj = await pageConnectee(browser, "dj.test");
  await dj.goto(url);
  await dj.getByRole("button", { name: "Statuer sur la diligence particulière" }).click();
  const dialogue = dj.getByRole("dialog");
  await dialogue.getByLabel("Rejeter").check();
  await dialogue.getByRole("button", { name: "Rejeter" }).click();

  await expect(dialogue.getByLabel("Motif du rejet", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await dj.context().close();
});

test("un avocat n'accède pas à une fiche dossier", async ({ page }) => {
  await seConnecter(page, "avocat.test");
  await page.goto("/dossiers/1");

  await expect(page.getByRole("heading", { name: "Vous n’avez pas les droits nécessaires" })).toBeVisible();
});

test("la fiche est traduite", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  const { url } = await creerDossier(page);

  // Switching language rewrites the page in place: wait for the result before navigating.
  await page.getByRole("button", { name: "en", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Summary" })).toBeVisible();

  // The choice survives a reload: it is stored in a cookie, not in page state.
  await page.goto(url);
  await expect(page.getByRole("tab", { name: "Summary" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Stages" })).toBeVisible();

  await page.getByRole("tab", { name: "History" }).click();
  // The history labels are translated, so no "written in French" warning is shown.
  await expect(page.getByText(/written by the server, in French/)).toHaveCount(0);
});
