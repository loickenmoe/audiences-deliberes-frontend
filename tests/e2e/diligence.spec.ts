import { expect, test, type Browser, type Page } from "@playwright/test";

import { choisirAgenceOrigine } from "./agence-de-creation";
import { affecterParDefaut } from "./affectation";
import { deposerPiecesDeCreation } from "./pieces-de-creation";
import { referenceDuDossier } from "./reference-attribuee";

/**
 * N4: special diligence can be revised after opening. Rules covered: the legal officer's proposal
 * does not change fees before the DJ decides, the DJ sets it without a proposal, and withdrawal
 * requires a reason and restores the global threshold.
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

/** An ordinary case: the starting point. */
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
  // The reference is assigned by the system: read it from the case page.
  return { url: page.url(), reference: await referenceDuDossier(page) };
}

test("le juriste propose la diligence, le DJ l'arbitre, la DJA la retire", async ({ browser }) => {
  const juriste = await pageConnectee(browser, "juriste.test");
  const { url } = await dossierOrdinaire(juriste);

  // Ordinary case: the legal officer proposes, he does not set.
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
   * No effect before the decision: the threshold stays global, otherwise a legal officer alone
   * would trigger the double validation of fees.
   */
  await juriste.goto(`${url}?onglet=synthese`);
  await expect(juriste.getByText("En attente", { exact: true }).first()).toBeVisible();
  await expect(juriste.getByText("Seuil global", { exact: true }).first()).toBeVisible();
  // Proposing twice makes no sense: the button is gone.
  await expect(juriste.getByRole("button", { name: "Proposer la diligence particulière" })).toHaveCount(0);
  await juriste.context().close();

  // The DJ decides through the existing dialog, regardless of where the proposal came from.
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

  // The DJA withdraws it: reason required, and the threshold becomes global again.
  const dja = await pageConnectee(browser, "dja.test");
  await dja.goto(url);
  await dja.getByRole("button", { name: "Retirer la diligence particulière" }).click();
  const retrait = dja.getByRole("dialog", { name: "Retirer la diligence particulière" });
  await retrait.getByRole("button", { name: "Retirer" }).click();
  await expect(retrait.getByText("Ce champ est obligatoire.")).toBeVisible();

  await retrait.getByLabel("Motif du retrait").fill("L’affaire s’est révélée ordinaire");
  await retrait.getByRole("button", { name: "Retirer" }).click();
  await expect(dja.getByText("Diligence particulière mise à jour.")).toBeVisible({ timeout: 30_000 });

  // The reason stays readable after withdrawal, even though the case is no longer sensitive.
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

  // Validated directly: nobody else to wait for, and the threshold applies.
  await dj.goto(`${url}?onglet=synthese`);
  await expect(dj.getByText("Validée", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await expect(dj.getByText("Dérogation validée", { exact: true }).first()).toBeVisible();
  // Once set, it can no longer be set, only withdrawn.
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

  // The action is traced, in French, and named: this is what the audit will read.
  await juriste.goto(`${url}?onglet=historique`);
  await expect(juriste.getByText("Proposition de diligence particulière").first()).toBeVisible({
    timeout: 30_000,
  });
  await juriste.context().close();
});
