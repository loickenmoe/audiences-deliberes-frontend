import { expect, test, type Browser, type Page } from "@playwright/test";

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
  const reference = `DOS-FICHE-${suffixe()}`;
  await page.goto("/dossiers/nouveau");
  await page.getByLabel("Référence", { exact: true }).fill(reference);
  await page.getByLabel("Nature du dossier", { exact: true }).selectOption(NATURE);
  await page.getByLabel("Juridiction saisie", { exact: true }).fill("TGI Douala");
  await page.getByLabel("Client", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Risque encouru (FCFA)", { exact: true }).fill("5000000");
  await page.getByLabel("Dossier de crédit d’origine", { exact: true }).fill("CRD-FICHE");
  await page.getByLabel("PV de transfert", { exact: true }).fill("PV-FICHE");
  await page.getByLabel("Juristes affectés", { exact: true }).selectOption({ index: 0 });
  await page.getByLabel("Avocats affectés", { exact: true }).selectOption({ index: 0 });
  if (sensible) {
    await page.getByLabel("Dossier sensible", { exact: true }).check();
    await page.getByLabel("Seuil proposé (FCFA)", { exact: true }).fill("60000000");
    await page.getByLabel("Type de client", { exact: true }).selectOption("VIP");
  }
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/dossiers\/\d+$/, { timeout: 60_000 });
  return { url: page.url(), reference };
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

test("positionner au second recours annonce puis crée le premier recours", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await creerDossier(page);

  await page.getByRole("tab", { name: "Étapes" }).click();
  await page.getByLabel("Choisissez une étape", { exact: true }).selectOption("RECOURS_2");
  await page.getByRole("button", { name: "Positionner" }).click();

  // L'effet de bord du backend est annoncé avant confirmation, pas découvert après.
  const dialogue = page.getByRole("dialog");
  await expect(dialogue).toContainText("Premier recours");
  await dialogue.getByRole("button", { name: "Confirmer" }).click();

  await expect(page.getByRole("heading", { name: "Premier recours" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Second recours" })).toBeVisible();
  await expect(page.getByText("Toutes les étapes existent déjà.")).toBeVisible();
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

test("l'onglet documents lit la liste dédiée, vide pour un dossier neuf", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await creerDossier(page);

  await page.getByRole("tab", { name: "Documents" }).click();
  await expect(page.getByText("Aucun document", { exact: true })).toBeVisible();
});

test("sensibilité validée, dérogation demandée, puis arbitrée par le DJ", async ({ browser }) => {
  const juriste = await pageConnectee(browser, "juriste.test");
  const { url } = await creerDossier(juriste, { sensible: true });

  // Le juriste ne peut pas statuer sur sa propre proposition.
  await expect(juriste.getByRole("button", { name: "Statuer sur la sensibilité" })).toHaveCount(0);
  // Et la dérogation n'est pas encore recevable : la sensibilité n'est pas validée.
  await expect(juriste.getByRole("button", { name: "Demander une dérogation" })).toHaveCount(0);

  const dj = await pageConnectee(browser, "dj.test");
  await dj.goto(url);
  await dj.getByRole("button", { name: "Statuer sur la sensibilité" }).click();
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
  await dj.getByRole("button", { name: "Statuer sur la sensibilité" }).click();
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
  await expect(page.getByText("History entries are written by the server, in French.")).toBeVisible();
});
