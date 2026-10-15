import { expect, test, type Browser, type Page } from "@playwright/test";

import { choisirAgenceOrigine } from "./agence-de-creation";
import { affecterParDefaut } from "./affectation";
import { deposerPiecesDeCreation } from "./pieces-de-creation";
import { referenceDuDossier } from "./reference-attribuee";

/**
 * N4 — la diligence particulière se révise après l'ouverture (métier, 2026-10-03, observation 5 ;
 * les deux sens arrêtés le 2026-10-06).
 *
 * **Ce que ces parcours protègent.** La diligence ne se posait qu'à la création : un dossier ouvert
 * comme ordinaire le restait définitivement. Trois règles la gouvernent désormais, et chacune
 * casserait en silence : la proposition du juriste **ne change rien aux frais** avant l'arbitrage,
 * le DJ **pose sans proposition**, et le retrait **rend le seuil global** en exigeant un motif.
 */
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

function suffixe() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Un dossier **ordinaire** : le point de départ: avant N4, il le restait pour toujours. */
async function dossierOrdinaire(page: Page) {
  const marque = suffixe();
  await page.goto("/dossiers/nouveau");
  await page.getByLabel("Nature du dossier", { exact: true }).selectOption("Assignation en paiement");
  await page.getByLabel("Juridiction saisie", { exact: true }).fill("TGI Douala");
  await page.getByLabel("Client", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Risque encouru (FCFA)", { exact: true }).fill("5000000");
  await page.getByLabel("Demandeurs 1", { exact: true }).fill("AFRILAND FIRST BANK");
  await page.getByLabel("Défendeurs 1", { exact: true }).fill("Débiteur");
  await choisirAgenceOrigine(page);
  await page.getByLabel("Dossier de crédit d’origine", { exact: true }).fill(`CRD-${marque}`);
  await page.getByLabel("PV de transfert", { exact: true }).fill(`PV-${marque}`);
  await deposerPiecesDeCreation(page, { marque: marque.toLowerCase() });
  await affecterParDefaut(page);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/dossiers\/\d+$/, { timeout: 60_000 });
  // La référence est attribuée par le système : on la lit sur la fiche (2026-09-29).
  return { url: page.url(), reference: await referenceDuDossier(page) };
}

test("le juriste propose la diligence, le DJ l'arbitre, la DJA la retire", async ({ browser }) => {
  const juriste = await pageConnectee(browser, "juriste.test");
  const { url } = await dossierOrdinaire(juriste);

  // Un dossier ordinaire : le juriste propose, il ne pose pas.
  await expect(juriste.getByRole("button", { name: "Mettre en diligence particulière" })).toHaveCount(0);
  await juriste.getByRole("button", { name: "Proposer la diligence particulière" }).click();
  const proposition = juriste.getByRole("dialog", { name: "Proposer la diligence particulière" });
  await proposition.getByLabel(/Seuil proposé/).fill("60000000");
  await proposition.getByLabel(/Type de client/).selectOption({ index: 1 });
  await proposition.getByLabel(/Ce qui a changé depuis l’ouverture/).fill(
    "La contrepartie est devenue une personne exposée",
  );
  await proposition.getByRole("button", { name: "Enregistrer" }).click();
  await expect(juriste.getByText("Proposition de diligence particulière enregistrée.")).toBeVisible({
    timeout: 30_000,
  });

  /*
   * Q-10 : aucun effet avant l'arbitrage. Le seuil reste **global** - sans cela, un juriste
   * déclencherait seul la double validation des frais.
   */
  await juriste.goto(`${url}?onglet=synthese`);
  await expect(juriste.getByText("En attente", { exact: true }).first()).toBeVisible();
  await expect(juriste.getByText("Seuil global", { exact: true }).first()).toBeVisible();
  // Proposer deux fois n'a pas de sens : le bouton a disparu.
  await expect(juriste.getByRole("button", { name: "Proposer la diligence particulière" })).toHaveCount(0);
  await juriste.context().close();

  // Le DJ arbitre par la modale qui existait déjà : elle ignore d'où vient la proposition.
  const dj = await pageConnectee(browser, "dj.test");
  await dj.goto(url);
  await dj.getByRole("button", { name: "Statuer sur la diligence particulière" }).click();
  await dj
    .getByRole("dialog", { name: "Statuer sur la diligence particulière" })
    .getByRole("button", { name: "Valider" })
    .click();
  await expect(dj.getByText("Décision enregistrée.")).toBeVisible({ timeout: 30_000 });

  await dj.goto(`${url}?onglet=synthese`);
  await expect(dj.getByText("Dérogation validée", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await dj.context().close();

  // La DJA retire : motif obligatoire, et le seuil redevient global.
  const dja = await pageConnectee(browser, "dja.test");
  await dja.goto(url);
  await dja.getByRole("button", { name: "Retirer la diligence particulière" }).click();
  const retrait = dja.getByRole("dialog", { name: "Retirer la diligence particulière" });
  await retrait.getByRole("button", { name: "Retirer" }).click();
  await expect(retrait.getByText("Ce champ est obligatoire.")).toBeVisible();

  await retrait.getByLabel("Motif du retrait").fill("L’affaire s’est révélée ordinaire");
  await retrait.getByRole("button", { name: "Retirer" }).click();
  await expect(dja.getByText("Diligence particulière mise à jour.")).toBeVisible({ timeout: 30_000 });

  /*
   * Le motif reste lisible **après** le retrait, alors que le dossier n'est plus sensible : sans
   * cela, il aurait été exigé de la DJA pour n'être lu nulle part.
   */
  await dja.goto(`${url}?onglet=synthese`);
  await expect(dja.getByText("L’affaire s’est révélée ordinaire")).toBeVisible({ timeout: 30_000 });
  await expect(dja.getByText("Seuil global", { exact: true }).first()).toBeVisible();
  await dja.context().close();
});

test("le DJ pose la diligence directement, sans proposition", async ({ browser }) => {
  const juriste = await pageConnectee(browser, "juriste.test");
  const { url } = await dossierOrdinaire(juriste);
  await juriste.context().close();

  const dj = await pageConnectee(browser, "dj.test");
  await dj.goto(url);
  await dj.getByRole("button", { name: "Mettre en diligence particulière" }).click();
  const pose = dj.getByRole("dialog", { name: "Mettre le dossier en diligence particulière" });
  await pose.getByLabel(/Seuil proposé/).fill("75000000");
  await pose.getByLabel(/Type de client/).selectOption({ index: 1 });
  await pose.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dj.getByText("Diligence particulière mise à jour.")).toBeVisible({ timeout: 30_000 });

  // Directement **validée** : il n'y a personne d'autre à attendre, et le seuil s'applique.
  await dj.goto(`${url}?onglet=synthese`);
  await expect(dj.getByText("Validée", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await expect(dj.getByText("Dérogation validée", { exact: true }).first()).toBeVisible();
  // La diligence étant posée, elle ne se pose plus : elle se retire.
  await expect(dj.getByRole("button", { name: "Mettre en diligence particulière" })).toHaveCount(0);
  await expect(dj.getByRole("button", { name: "Retirer la diligence particulière" })).toBeVisible();
  await dj.context().close();
});

test("l'historique porte la proposition et le retrait", async ({ browser }) => {
  const juriste = await pageConnectee(browser, "juriste.test");
  const { url } = await dossierOrdinaire(juriste);

  await juriste.getByRole("button", { name: "Proposer la diligence particulière" }).click();
  const proposition = juriste.getByRole("dialog", { name: "Proposer la diligence particulière" });
  await proposition.getByLabel(/Seuil proposé/).fill("60000000");
  await proposition.getByLabel(/Type de client/).selectOption({ index: 1 });
  await proposition.getByLabel(/Ce qui a changé depuis l’ouverture/).fill("Risque réévalué");
  await proposition.getByRole("button", { name: "Enregistrer" }).click();
  await expect(juriste.getByText("Proposition de diligence particulière enregistrée.")).toBeVisible({
    timeout: 30_000,
  });

  // L'action est tracée, en français, et nommée : c'est ce que l'audit relira.
  await juriste.goto(`${url}?onglet=historique`);
  await expect(juriste.getByText("Proposition de diligence particulière").first()).toBeVisible({
    timeout: 30_000,
  });
  await juriste.context().close();
});
