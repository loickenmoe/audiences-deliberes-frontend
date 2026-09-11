import { expect, test, type Page } from "@playwright/test";

/**
 * Délibérés (écrans 10, 26, 27) **contre le backend réel**, cycle Q-78 : mise en délibéré →
 * prorogation ou rabattement pendant l'attente → décision, qui vide le délibéré.
 */

const MOT_DE_PASSE = "Password1!";

async function seConnecter(page: Page, identifiant: string) {
  await page.goto("/login");
  await page.getByLabel("Identifiant", { exact: true }).fill(identifiant);
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Connexion" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
}

function suffixe() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** `YYYY-MM-DD` local, dans `jours` jours. */
function dansJours(jours: number) {
  const date = new Date();
  date.setDate(date.getDate() + jours);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Crée un dossier, fait passer son instance « En cours » puis « En délibéré », et ouvre l'onglet Délibérés. */
async function dossierEnDelibere(page: Page) {
  await page.goto("/dossiers/nouveau");
  await page.getByLabel("Référence", { exact: true }).fill(`DOS-DEL-${suffixe()}`);
  await page.getByLabel("Nature du dossier", { exact: true }).selectOption("Assignation en paiement");
  await page.getByLabel("Juridiction saisie", { exact: true }).fill("TGI Douala");
  await page.getByLabel("Client", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Risque encouru (FCFA)", { exact: true }).fill("5000000");
  await page.getByLabel("Dossier de crédit d’origine", { exact: true }).fill("CRD-DEL");
  await page.getByLabel("PV de transfert", { exact: true }).fill("PV-DEL");
  await page.getByLabel("Juristes affectés", { exact: true }).selectOption({ index: 0 });
  await page.getByLabel("Avocats affectés", { exact: true }).selectOption({ index: 0 });
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/dossiers\/\d+$/, { timeout: 60_000 });

  await page.getByRole("tab", { name: "Étapes" }).click();
  for (const statut of ["EN_COURS", "EN_DELIBERE"]) {
    await page.getByLabel("Faire passer à", { exact: true }).selectOption(statut);
    await page.getByRole("button", { name: "Appliquer" }).click();
    await expect(page.getByText("Statut de l’étape mis à jour.").first()).toBeVisible();
  }
  // En délibéré, l'onglet Étapes renvoie vers l'onglet Délibérés.
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
  // Un seul délibéré en attente par étape : l'étape ne se remet pas en délibéré.
  await expect(page.getByRole("button", { name: "Mettre en délibéré" })).toBeDisabled();

  await page.getByRole("button", { name: /^Proroger le délibéré annoncé au / }).click();
  const prorogation = page.getByRole("dialog", { name: "Proroger le délibéré" });
  await prorogation.getByLabel("Nouvelle date du délibéré", { exact: true }).fill(dansJours(14));
  await prorogation.getByLabel("Motif — facultatif", { exact: true }).fill("Juge empêché");
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
  // Plus aucune étape en délibéré : l'écran l'explique au lieu de proposer l'action.
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
  // Sans échéance, rien ne part : la modale reste ouverte sur le champ manquant.
  await expect(decision.getByLabel("Échéance du délai de recours", { exact: true })).toBeVisible();

  await decision.getByLabel("Échéance du délai de recours", { exact: true }).fill(`${dansJours(30)}T09:00`);
  await decision.getByRole("button", { name: "Enregistrer" }).click();

  // Assertions sur la carte du délibéré : les listes « Résultat » des modales fermées restent dans
  // la page, et leurs options portent les mêmes libellés.
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
