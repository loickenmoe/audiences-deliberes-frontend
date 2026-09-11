import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * GED (écrans 36 et 37) **contre le backend réel et MinIO** : la file des demandes de suppression
 * du DJ/DJA et le rapport journalier.
 */

const MOT_DE_PASSE = "Password1!";

const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
);

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
  return Math.random().toString(36).slice(2, 8).toLowerCase();
}

/**
 * Le juriste crée un dossier avec un PV au nom unique, puis en demande la suppression. Le nom est
 * unique pour retrouver la ligne dans la file du DJ, qui voit les demandes de tous les dossiers.
 */
async function pieceDontLaSuppressionEstDemandee(browser: Browser) {
  const nom = `pv-${suffixe()}.pdf`;
  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto("/dossiers/nouveau");
  const reference = `DOS-GED-${suffixe().toUpperCase()}`;
  await juriste.getByLabel("Référence", { exact: true }).fill(reference);
  await juriste.getByLabel("Nature du dossier", { exact: true }).selectOption("Assignation en paiement");
  await juriste.getByLabel("Juridiction saisie", { exact: true }).fill("TGI Douala");
  await juriste.getByLabel("Client", { exact: true }).selectOption({ index: 1 });
  await juriste.getByLabel("Risque encouru (FCFA)", { exact: true }).fill("5000000");
  await juriste.getByLabel("Dossier de crédit d’origine", { exact: true }).fill("CRD-GED");
  await juriste.getByLabel("PV de transfert", { exact: true }).fill("PV-GED");
  await juriste.getByLabel("Juristes affectés", { exact: true }).selectOption({ index: 0 });
  await juriste.getByLabel("Avocats affectés", { exact: true }).selectOption({ index: 0 });
  await juriste.locator('input[name="piece-PV_TRANSFERT"]').setInputFiles({ name: nom, mimeType: "application/pdf", buffer: PDF });
  await juriste.getByRole("button", { name: "Enregistrer" }).click();
  await juriste.waitForURL(/\/dossiers\/\d+$/, { timeout: 60_000 });
  const url = juriste.url();

  await juriste.getByRole("tab", { name: "Documents" }).click();
  await juriste.getByRole("button", { name: `Demander la suppression — ${nom}` }).click();
  await juriste.getByRole("dialog").getByRole("button", { name: "Demander la suppression" }).click();
  await expect(juriste.getByText("Demande de suppression envoyée au DJ et au DJA.")).toBeVisible();
  await juriste.context().close();
  return { nom, reference, url };
}

async function redemander(browser: Browser, url: string, nom: string) {
  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto(`${url}?onglet=documents`);
  await juriste.getByRole("button", { name: `Demander la suppression — ${nom}` }).click();
  await juriste.getByRole("dialog").getByRole("button", { name: "Demander la suppression" }).click();
  await expect(juriste.getByText("Demande de suppression envoyée au DJ et au DJA.")).toBeVisible();
  await juriste.context().close();
}

test("le DJ voit quoi supprimer, rejette avec un motif, puis approuve la demande suivante", async ({ browser }) => {
  const { nom, reference, url } = await pieceDontLaSuppressionEstDemandee(browser);

  const dj = await pageConnectee(browser, "dj.test");
  await dj.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Demandes de suppression" }).click();
  await dj.waitForURL(/\/ged\/demandes-suppression/, { timeout: 60_000 });

  // La demande nomme son fichier et son dossier (Q-79).
  const ligne = dj.getByRole("row", { name: new RegExp(nom) });
  await expect(ligne).toContainText(reference);

  await dj.getByRole("button", { name: `Rejeter la demande — ${nom}` }).click();
  const rejet = dj.getByRole("dialog", { name: "Rejeter la demande" });
  await rejet.getByRole("button", { name: "Rejeter" }).click();
  // Sans motif, rien ne part.
  await expect(rejet.getByText(/obligatoire/i)).toBeVisible();
  await rejet.getByLabel("Motif du rejet", { exact: true }).fill("Pièce encore utile au dossier");
  await rejet.getByRole("button", { name: "Rejeter" }).click();
  await expect(dj.getByRole("row", { name: new RegExp(nom) })).toHaveCount(0);

  await dj.getByRole("button", { name: "Toutes" }).click();
  await expect(dj.getByRole("row", { name: new RegExp(nom) }).first()).toContainText("Motif : Pièce encore utile au dossier");

  // Le juriste redemande ; cette fois le DJ approuve, et la pièce quitte le dossier.
  await redemander(browser, url, nom);
  await dj.getByRole("button", { name: "En attente" }).click();
  await dj.reload();
  await dj.getByRole("button", { name: `Approuver la suppression — ${nom}` }).click();
  await dj.getByRole("dialog", { name: "Approuver la suppression ?" }).getByRole("button", { name: "Approuver" }).click();
  await expect(dj.getByRole("row", { name: new RegExp(nom) })).toHaveCount(0);

  await dj.goto(`${url}?onglet=documents`);
  await expect(dj.getByRole("row", { name: new RegExp(nom) })).toHaveCount(0);
  await dj.context().close();
});

test("une suppression directe par le DJ ferme la demande en attente (Q-79)", async ({ browser }) => {
  const { nom, url } = await pieceDontLaSuppressionEstDemandee(browser);

  const dj = await pageConnectee(browser, "dj.test");
  await dj.goto(`${url}?onglet=documents`);
  await dj.getByRole("button", { name: `Supprimer — ${nom}` }).click();
  await dj.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
  await expect(dj.getByText("Document supprimé.")).toBeVisible();

  await dj.goto("/ged/demandes-suppression");
  await expect(dj.getByRole("heading", { name: "Demandes de suppression", level: 1 })).toBeVisible();
  // Plus de demande fantôme en attente : elle est close avec le document.
  await expect(dj.getByRole("row", { name: new RegExp(nom) })).toHaveCount(0);
  await dj.getByRole("button", { name: "Toutes" }).click();
  await expect(dj.getByRole("row", { name: new RegExp(nom) }).first()).toContainText("Approuvée");
  await dj.context().close();
});

test("rapport journalier : l'activité du jour, puis un état vide lisible un jour sans activité", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Rapport journalier GED" }).click();
  await page.waitForURL(/\/ged\/rapport-journalier/, { timeout: 60_000 });

  await expect(page.getByText("Dossiers manipulés")).toBeVisible();
  await expect(page.getByText("Pièces ajoutées")).toBeVisible();

  await page.getByLabel("Date du rapport", { exact: true }).fill("2020-01-02");
  await expect(page.getByText("Aucune activité ce jour-là.")).toBeVisible();
});

test("le rapport s'ouvre à l'Assistante ; la file des suppressions reste réservée au DJ et à la DJA", async ({ browser }) => {
  const assistante = await pageConnectee(browser, "assistante.test");
  await assistante.goto("/ged/rapport-journalier");
  await expect(assistante.getByRole("heading", { name: "Rapport journalier GED", level: 1 })).toBeVisible();
  await assistante.context().close();

  const juriste = await pageConnectee(browser, "juriste.test");
  await expect(
    juriste.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Demandes de suppression" }),
  ).toHaveCount(0);
  await juriste.goto("/ged/demandes-suppression");
  await expect(juriste.getByRole("heading", { name: "Vous n’avez pas les droits nécessaires" })).toBeVisible();
  await juriste.context().close();
});
