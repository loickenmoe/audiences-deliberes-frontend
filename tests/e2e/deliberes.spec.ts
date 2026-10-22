import { expect, test, type Page } from "@playwright/test";
import { affecterParDefaut } from "./affectation";
import { deposerPiecesDeCreation } from "./pieces-de-creation";
import { choisirAgenceOrigine } from "./agence-de-creation";

/**
 * Deliberations (screens 10, 26, 27) against the real backend: deliberation, then extension or
 * cancellation while waiting, then a decision that empties the deliberation.
 */

const MOT_DE_PASSE = "Password1!";

async function seConnecter(page: Page, identifiant: string) {
  await page.goto("/login");
  await page.getByLabel("Identifiant", { exact: true }).fill(identifiant);
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Connexion" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
}


/** Local `YYYY-MM-DD`, `jours` days from now. */
function dansJours(jours: number) {
  const date = new Date();
  date.setDate(date.getDate() + jours);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Creates a case, moves its proceeding to "En cours" then "En délibéré", and opens the Délibérés tab. */
async function dossierEnDelibere(page: Page) {
  await page.goto("/dossiers/nouveau");
  await page.getByLabel("Nature du dossier", { exact: true }).selectOption("Assignation en paiement");
  await page.getByLabel("Juridiction saisie", { exact: true }).fill("TGI Douala");
  await page.getByLabel("Client", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Risque encouru (FCFA)", { exact: true }).fill("5000000");
  // Mandatory: at least one party on each side.
  await page.getByLabel("Demandeurs 1", { exact: true }).fill("AFRILAND FIRST BANK");
  await page.getByLabel("Défendeurs 1", { exact: true }).fill("Débiteur");
  // Mandatory: the branch comes from the reference data.
  await choisirAgenceOrigine(page);
  await page.getByLabel("Dossier de crédit d’origine", { exact: true }).fill("CRD-DEL");
  await page.getByLabel("PV de transfert", { exact: true }).fill("PV-DEL");
  await deposerPiecesDeCreation(page, { marque: "del" });
  await affecterParDefaut(page);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/dossiers\/\d+$/, { timeout: 60_000 });

  await page.getByRole("tab", { name: "Étapes" }).click();
  await page.getByLabel("Faire passer à", { exact: true }).selectOption("EN_COURS");
  await page.getByRole("button", { name: "Appliquer" }).click();
  await expect(page.getByText("Statut de l’étape mis à jour.").first()).toBeVisible();

  /*
   * A held hearing is required before deliberation (REC-NEG-028), otherwise the backend rejects the
   * transition with a 400. Schedule one for today and enter its report, which marks it as held.
   */
  await page.getByRole("tab", { name: "Audiences" }).click();
  await page.getByRole("button", { name: "Planifier une audience" }).click();
  await page.getByLabel("Date de l’audience", { exact: true }).fill(dansJours(0));
  await page
    .getByRole("dialog", { name: "Planifier une audience" })
    .getByRole("button", { name: "Enregistrer" })
    .click();
  await expect(page.getByRole("row").filter({ hasText: "Planifiée" })).toHaveCount(1);

  await page.getByRole("button", { name: "Saisir le compte rendu" }).click();
  const compteRendu = page.getByRole("dialog", { name: "Compte rendu d’audience" });
  await compteRendu.getByLabel("Compte rendu", { exact: true }).fill("Affaire appelée, mise en délibéré.");
  await compteRendu.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Compte rendu enregistré.")).toBeVisible();

  await page.getByRole("tab", { name: "Étapes" }).click();
  await page.getByLabel("Faire passer à", { exact: true }).selectOption("EN_DELIBERE");
  await page.getByRole("button", { name: "Appliquer" }).click();
  await expect(page.getByText("Statut de l’étape mis à jour.").first()).toBeVisible();
  // Under deliberation, the Étapes tab points to the Délibérés tab.
  await expect(page.getByText(/se gèrent dans l’onglet Délibérés/)).toBeVisible();
  await page.getByRole("tab", { name: "Délibérés" }).click();
}

async function mettreEnDelibere(page: Page, date: string) {
  await page.getByRole("button", { name: "Mettre en délibéré" }).click();
  const dialogue = page.getByRole("dialog", { name: "Mettre en délibéré" });
  await dialogue.getByLabel("Date annoncée du délibéré", { exact: true }).fill(date);
  await dialogue.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText(/^Délibéré annoncé au /)).toBeVisible();
}

test("mettre en délibéré puis proroger : la date annoncée change et l'historique la garde", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await dossierEnDelibere(page);
  await mettreEnDelibere(page, dansJours(7));

  await expect(page.getByText("En attente de décision")).toBeVisible();
  // Only one pending deliberation per step: the step cannot be put under deliberation again.
  await expect(page.getByRole("button", { name: "Mettre en délibéré" })).toBeDisabled();

  await page.getByRole("button", { name: /^Proroger le délibéré annoncé au / }).click();
  const prorogation = page.getByRole("dialog", { name: "Proroger le délibéré" });
  await prorogation.getByLabel("Nouvelle date du délibéré", { exact: true }).fill(dansJours(14));
  await prorogation.getByLabel("Motif - facultatif", { exact: true }).fill("Juge empêché");
  await prorogation.getByRole("button", { name: "Proroger" }).click();

  await expect(page.getByText("Prorogé une fois")).toBeVisible();
  await page.getByRole("button", { name: "Historique des prorogations" }).click();
  const historique = page.getByRole("dialog", { name: "Historique des prorogations" });
  await expect(historique.getByRole("row").filter({ hasText: "Juge empêché" })).toHaveCount(1);
});

test("rabattre : l'étape revient « En cours » et le délibéré reste tracé avec son motif", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await dossierEnDelibere(page);
  await mettreEnDelibere(page, dansJours(7));

  await page.getByRole("button", { name: /^Rabattre le délibéré annoncé au / }).click();
  const rabattement = page.getByRole("dialog", { name: "Rabattre le délibéré" });
  await rabattement.getByLabel("Motif", { exact: true }).fill("Réouverture des débats");
  await rabattement.getByRole("button", { name: "Rabattre" }).click();

  await expect(page.getByText("Motif : Réouverture des débats")).toBeVisible();
  await expect(page.getByText("Rabattu", { exact: true })).toBeVisible();
  // No step under deliberation: the screen explains it instead of offering the action.
  await expect(page.getByText(/Aucune étape n’est en délibéré/)).toBeVisible();
});

test("décision défavorable : l'échéance de recours est exigée, puis suivie ; la grosse se lève", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await dossierEnDelibere(page);
  await mettreEnDelibere(page, dansJours(3));

  await page.getByRole("button", { name: /^Enregistrer la décision du délibéré annoncé au / }).click();
  const decision = page.getByRole("dialog", { name: "Enregistrer la décision" });
  await decision.getByLabel("Résultat", { exact: true }).selectOption("DEFAVORABLE");
  await decision.getByRole("button", { name: "Enregistrer" }).click();
  // Without a deadline, nothing is sent: the dialog stays open on the missing field.
  await expect(decision.getByLabel("Échéance du délai de recours", { exact: true })).toBeVisible();

  await decision.getByLabel("Échéance du délai de recours", { exact: true }).fill(`${dansJours(30)}T09:00`);
  await decision.getByRole("button", { name: "Enregistrer" }).click();

  // Assert on the deliberation card: the "Résultat" lists of closed dialogs stay in the page with
  // the same option labels.
  const carte = page.getByRole("listitem").filter({ hasText: /^.*Décision du /s });
  await expect(carte.getByText("Vidé", { exact: true })).toBeVisible();
  await expect(carte.getByText("Défavorable", { exact: true })).toBeVisible();
  await expect(carte.getByRole("region", { name: "Délai de recours" })).toContainText(/Pour exercer un recours/);

  await page.getByRole("button", { name: "Marquer la grosse levée" }).click();
  await expect(page.getByRole("button", { name: "Remettre « à lever »" })).toBeVisible();
});

test("décision déjà rendue et favorable : enregistrée d'un geste, sans voie de recours", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await dossierEnDelibere(page);

  await page.getByRole("button", { name: "Mettre en délibéré" }).click();
  const dialogue = page.getByRole("dialog", { name: "Mettre en délibéré" });
  await dialogue.getByLabel("La décision est déjà rendue").check();
  await dialogue.getByLabel("Date de la décision", { exact: true }).fill(dansJours(0));
  await dialogue.getByLabel("Résultat", { exact: true }).selectOption("FAVORABLE");
  await expect(dialogue.getByLabel("Échéance du délai de recours", { exact: true })).toHaveCount(0);
  await dialogue.getByRole("button", { name: "Enregistrer" }).click();

  const carte = page.getByRole("listitem").filter({ hasText: /^.*Décision du /s });
  await expect(carte.getByText("Favorable", { exact: true })).toBeVisible();
  await expect(carte.getByText(/aucune voie de recours/)).toBeVisible();
});
