import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Pièces d'un dossier (création, onglet Documents) **contre le backend réel et MinIO**.
 *
 * Les fichiers sont fabriqués en mémoire : un PDF minimal, une image PNG d'un pixel, un texte. Ce
 * sont de vrais fichiers aux yeux du backend, qui dérive leur format de l'extension.
 */

const MOT_DE_PASSE = "Password1!";

const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
);
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64",
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
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Remplit un dossier de recouvrement, sans l'envoyer. */
async function remplirDossier(page: Page) {
  await page.goto("/dossiers/nouveau");
  await page.getByLabel("Référence", { exact: true }).fill(`DOS-DOC-${suffixe()}`);
  await page.getByLabel("Nature du dossier", { exact: true }).selectOption("Assignation en paiement");
  await page.getByLabel("Juridiction saisie", { exact: true }).fill("TGI Douala");
  await page.getByLabel("Client", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Risque encouru (FCFA)", { exact: true }).fill("5000000");
  await page.getByLabel("Dossier de crédit d’origine", { exact: true }).fill("CRD-DOC");
  await page.getByLabel("PV de transfert", { exact: true }).fill("PV-DOC");
  await page.getByLabel("Juristes affectés", { exact: true }).selectOption({ index: 0 });
  await page.getByLabel("Avocats affectés", { exact: true }).selectOption({ index: 0 });
}

async function creerAvecPv(page: Page) {
  await remplirDossier(page);
  await page.locator('input[name="piece-PV_TRANSFERT"]').setInputFiles({
    name: "pv-transfert.pdf",
    mimeType: "application/pdf",
    buffer: PDF,
  });
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/dossiers\/\d+$/, { timeout: 60_000 });
  return page.url();
}

test("une pièce jointe se lit avant la création, puis se retrouve sur la fiche", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await remplirDossier(page);

  await page.locator('input[name="piece-PV_TRANSFERT"]').setInputFiles({
    name: "pv-transfert.pdf",
    mimeType: "application/pdf",
    buffer: PDF,
  });

  // Lire avant de valider : l'aperçu est servi depuis le fichier local, rien n'est encore envoyé.
  await page.getByRole("button", { name: "Aperçu" }).click();
  const apercu = page.getByRole("dialog", { name: "Aperçu — pv-transfert.pdf" });
  await expect(apercu.locator("iframe")).toHaveAttribute("src", /^blob:/);
  await apercu.getByRole("button", { name: "Fermer" }).first().click();

  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/dossiers\/\d+$/, { timeout: 60_000 });

  await page.getByRole("tab", { name: "Documents" }).click();
  const ligne = page.getByRole("row", { name: /pv-transfert\.pdf/ });
  await expect(ligne).toBeVisible();
  await expect(ligne).toContainText("PV de transfert");
});

test("un format refusé est signalé avant tout envoi", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await remplirDossier(page);

  await page.locator('input[name="piece-PV_TRANSFERT"]').setInputFiles({
    name: "pv.docx",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("x"),
  });

  await expect(page.getByRole("alert").filter({ hasText: "PDF, PNG, JPG, TXT, XLSX" })).toBeVisible();
});

test("depuis la fiche : déposer, consulter et télécharger une pièce", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await creerAvecPv(page);
  await page.getByRole("tab", { name: "Documents" }).click();

  await page.getByLabel("Type de pièce", { exact: true }).selectOption("AUTRE");
  await page.locator('input[name="piece-fiche"]').setInputFiles({ name: "scan.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Déposer" }).click();
  await expect(page.getByText("Pièce déposée.")).toBeVisible();

  // Consulter : l'URL pré-signée est lue dans la page (CORS MinIO) et l'image s'affiche.
  await page.getByRole("button", { name: "Consulter — scan.png" }).click();
  await expect(page.getByRole("dialog", { name: "Aperçu — scan.png" }).getByRole("img", { name: "scan.png" })).toBeVisible();
  await page.getByRole("dialog", { name: "Aperçu — scan.png" }).getByRole("button", { name: "Fermer" }).first().click();

  // Télécharger : le fichier garde son nom d'origine.
  const telechargement = page.waitForEvent("download");
  await page.getByRole("button", { name: "Télécharger — pv-transfert.pdf" }).click();
  expect((await telechargement).suggestedFilename()).toBe("pv-transfert.pdf");
});

test("un juriste demande la suppression ; le DJ supprime directement", async ({ browser }) => {
  const juriste = await pageConnectee(browser, "juriste.test");
  const url = await creerAvecPv(juriste);
  await juriste.getByRole("tab", { name: "Documents" }).click();

  // Juriste auteur : une demande, le document reste visible (202).
  await juriste.getByRole("button", { name: "Demander la suppression — pv-transfert.pdf" }).click();
  await juriste.getByRole("dialog").getByRole("button", { name: "Demander la suppression" }).click();
  await expect(juriste.getByText("Demande de suppression envoyée au DJ et au DJA.")).toBeVisible();
  await expect(juriste.getByRole("row", { name: /pv-transfert\.pdf/ })).toBeVisible();
  await juriste.context().close();

  // DJ : suppression immédiate (200), la pièce disparaît.
  const dj = await pageConnectee(browser, "dj.test");
  await dj.goto(`${url}?onglet=documents`);
  await dj.getByRole("button", { name: "Supprimer — pv-transfert.pdf" }).click();
  await dj.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
  await expect(dj.getByText("Document supprimé.")).toBeVisible();
  await expect(dj.getByRole("row", { name: /pv-transfert\.pdf/ })).toHaveCount(0);
  await dj.context().close();
});
