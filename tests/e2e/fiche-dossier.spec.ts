import { expect, test, type Browser, type Page } from "@playwright/test";
import { affecterParDefaut } from "./affectation";
import { deposerPiecesDeCreation } from "./pieces-de-creation";
import { referenceDuDossier } from "./reference-attribuee";
import { choisirAgenceOrigine } from "./agence-de-creation";

/**
 * Parcours de la fiche dossier (écrans 07, 08, 15, 16, 18) **contre le backend réel**.
 *
 * Chaque test crée son propre dossier par l'interface : la création redirige désormais vers la
 * fiche, ce qui vérifie au passage la levée de QF-22.
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

function suffixe() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Crée un dossier par l'interface et renvoie l'URL de sa fiche. */
async function creerDossier(page: Page, { sensible = false } = {}) {
  await page.goto("/dossiers/nouveau");
  await page.getByLabel("Nature du dossier", { exact: true }).selectOption(NATURE);
  await page.getByLabel("Juridiction saisie", { exact: true }).fill("TGI Douala");
  await page.getByLabel("Client", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Risque encouru (FCFA)", { exact: true }).fill("5000000");
  // Obligatoires depuis le 2026-10-05 : au moins une partie de chaque côté.
  await page.getByLabel("Demandeurs 1", { exact: true }).fill("AFRILAND FIRST BANK");
  await page.getByLabel("Défendeurs 1", { exact: true }).fill("Débiteur");
  // Obligatoire depuis le 2026-10-05 (observation 2) : l'agence vient du référentiel.
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
  // La référence est attribuée par le système : on la lit sur la fiche (2026-09-29).
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

  // Depuis OUVERTURE, le backend n'accepte que EN_COURS : c'est la seule option offerte.
  await expect(choix.locator("option")).toHaveText(["Choisissez un statut", "En cours"]);

  await choix.selectOption("EN_COURS");
  await page.getByRole("button", { name: "Appliquer" }).click();
  await expect(page.getByText("Statut de l’étape mis à jour.")).toBeVisible();

  // L'étape est passée EN_COURS : la seule suite possible est désormais EN_DELIBERE.
  await expect(choix.locator("option")).toHaveText(["Choisissez un statut", "En délibéré"]);
});

test("positionner au pourvoi en cassation annonce puis crée l'appel", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await creerDossier(page);

  await page.getByRole("tab", { name: "Étapes" }).click();
  await page.getByLabel("Choisissez une étape", { exact: true }).selectOption("RECOURS_2");
  await page.getByRole("button", { name: "Positionner" }).click();

  // L'effet de bord du backend est annoncé avant confirmation, pas découvert après.
  const dialogue = page.getByRole("dialog");
  await expect(dialogue).toContainText("Appel");
  await dialogue.getByRole("button", { name: "Confirmer" }).click();

  await expect(page.getByRole("heading", { name: "Appel" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pourvoi en cassation" })).toBeVisible();
  // Le pourvoi CCJA reste à ouvrir : les deux cassations sont concurrentes, pas successives.
  await expect(page.getByText("Toutes les étapes existent déjà.")).toHaveCount(0);
});

/**
 * Les deux cassations coexistent (observation métier du 2026-09-25). Ce parcours vérifie ce que
 * seul l'écran peut montrer : que le pourvoi CCJA s'ouvre **sans** faire naître une étape Cour
 * Suprême, et que le dossier porte ensuite les deux.
 */
test("un dossier peut être porté devant la Cour Suprême et devant la CCJA", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  const { reference } = await creerDossier(page);

  await page.getByRole("tab", { name: "Étapes" }).click();
  await page.getByLabel("Choisissez une étape", { exact: true }).selectOption("RECOURS_2_CCJA");
  await page.getByRole("button", { name: "Positionner" }).click();

  // L'appel est annoncé, la Cour Suprême ne l'est pas : elle n'est pas un antécédent du pourvoi CCJA.
  const dialogue = page.getByRole("dialog");
  await expect(dialogue).toContainText("Appel");
  await expect(dialogue).not.toContainText("Pourvoi en cassation");
  await dialogue.getByRole("button", { name: "Confirmer" }).click();

  await expect(page.getByRole("heading", { name: "Pourvoi CCJA" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pourvoi en cassation", exact: true })).toHaveCount(0);

  // Le pourvoi national s'ouvre ensuite, à côté : le dossier est devant les deux juridictions.
  await page.getByLabel("Choisissez une étape", { exact: true }).selectOption("RECOURS_2");
  await page.getByRole("button", { name: "Positionner" }).click();
  const second = page.getByRole("dialog");
  if (await second.isVisible()) {
    await second.getByRole("button", { name: "Confirmer" }).click();
  }
  await expect(page.getByRole("heading", { name: "Pourvoi en cassation", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pourvoi CCJA" })).toBeVisible();
  await expect(page.getByText("Toutes les étapes existent déjà.")).toBeVisible();

  // La liste des dossiers montre les deux cassations : n'en afficher qu'une en cacherait la moitié.
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
  // Valider sans rien changer conserve les personnes déjà affectées : le backend répond ERR-003.
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
 * L'onglet Documents lit l'endpoint dédié `GET /dossiers/{id}/documents`, et non le champ
 * `documents` de la fiche, qui reste vide par construction (Q-67).
 *
 * **Il ne peut plus être vide sur un dossier neuf.** Les pièces sont obligatoires à la création
 * depuis le 2026-09-29 : un dossier de recouvrement naît avec son dossier de crédit et son PV de
 * transfert. Ce test vérifiait l'état vide, prémisse que cette règle a supprimée ; il vérifie
 * désormais que l'onglet présente bien les deux pièces déposées à la création.
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

  // Le juriste ne peut pas statuer sur sa propre proposition.
  await expect(juriste.getByRole("button", { name: "Statuer sur la diligence particulière" })).toHaveCount(0);
  // Et la dérogation n'est pas encore recevable : la sensibilité n'est pas validée.
  await expect(juriste.getByRole("button", { name: "Demander une dérogation" })).toHaveCount(0);

  const dj = await pageConnectee(browser, "dj.test");
  await dj.goto(url);
  await dj.getByRole("button", { name: "Statuer sur la diligence particulière" }).click();
  await dj.getByRole("dialog").getByRole("button", { name: "Valider" }).click();
  await expect(dj.getByText("Décision enregistrée.")).toBeVisible();

  await juriste.reload();
  await expect(juriste.getByRole("button", { name: "Demander une dérogation" })).toBeVisible();

  // La demande de dérogation part chez le DJ…
  await juriste.getByRole("button", { name: "Demander une dérogation" }).click();
  const demande = juriste.getByRole("dialog", { name: "Demander une dérogation de seuil" });
  await demande.getByLabel("Nouveau seuil (FCFA)", { exact: true }).fill("80000000");
  await demande.getByLabel("Motif", { exact: true }).fill("Client stratégique");
  await demande.getByRole("button", { name: "Enregistrer" }).click();
  await expect(juriste.getByText("Demande de dérogation envoyée.")).toBeVisible();

  // …qui peut désormais l'arbitrer : c'est exactement ce que QF-23 empêchait.
  await dj.reload();
  await expect(dj.getByRole("heading", { name: "Dérogations de seuil en attente" })).toBeVisible();
  await dj.getByRole("button", { name: "Arbitrer" }).click();
  await dj.getByRole("dialog", { name: "Arbitrer la dérogation de seuil" }).getByRole("button", { name: "Valider" }).click();
  await expect(dj.getByText("Dérogation arbitrée.")).toBeVisible();
  // La file est vide : la carte disparaît.
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

  // Changer de langue réécrit la page en place : attendre le résultat plutôt que de naviguer
  // aussitôt, ce qui partait avant que le choix soit enregistré.
  await page.getByRole("button", { name: "en", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Summary" })).toBeVisible();

  // Et le choix survit à un rechargement : il est porté par un cookie, pas par l'état de la page.
  await page.goto(url);
  await expect(page.getByRole("tab", { name: "Summary" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Stages" })).toBeVisible();

  // L'historique est rédigé en français par le serveur : la fiche le dit au lieu de le cacher.
  await page.getByRole("tab", { name: "History" }).click();
  // QF-24 close par Q-112 : l'avertissement a disparu, parce que les libelles sont traduits.
  await expect(page.getByText(/written by the server, in French/)).toHaveCount(0);
});
