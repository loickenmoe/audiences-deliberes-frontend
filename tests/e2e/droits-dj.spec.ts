import { expect, test, type Page } from "@playwright/test";
import { affecterParDefaut } from "./affectation";
import { deposerPiecesDeCreation } from "./pieces-de-creation";
import { choisirAgenceOrigine } from "./agence-de-creation";

/**
 * The DJ and DJA have all the rights of a legal officer plus their own: the realm grants them
 * `ROLE_JURISTE` as a composite role. Checked against real Keycloak and backend: the DJ token opens
 * legal officer actions without losing the DJ profile or its own rights.
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

test("le DJ agit en juriste — étape et audience — sans cesser d'être DJ", async ({ page }) => {
  await seConnecter(page, "dj.test");
  // The displayed profile remains DJ, despite the legal officer role it carries.
  await expect(page.getByRole("banner").getByText("Directeur Juridique", { exact: true })).toBeVisible();

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
  await page.getByLabel("Dossier de crédit d’origine", { exact: true }).fill("CRD-DJ");
  await page.getByLabel("PV de transfert", { exact: true }).fill("PV-DJ");
  await deposerPiecesDeCreation(page, { marque: "dj" });
  await affecterParDefaut(page);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/dossiers\/\d+$/, { timeout: 60_000 });

  // Managing steps: restricted to ROLE_JURISTE, which the DJ carries.
  await page.getByRole("tab", { name: "Étapes" }).click();
  await page.getByLabel("Faire passer à", { exact: true }).selectOption("EN_COURS");
  await page.getByRole("button", { name: "Appliquer" }).click();
  await expect(page.getByText("Statut de l’étape mis à jour.")).toBeVisible();

  // Scheduling a hearing: same.
  await page.getByRole("tab", { name: "Audiences" }).click();
  await page.getByRole("button", { name: "Planifier une audience" }).click();
  await page.getByLabel("Date de l’audience", { exact: true }).fill(dansJours(9));
  await page.getByRole("dialog", { name: "Planifier une audience" }).getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Planifiée" })).toHaveCount(1);

  // Its own rights remain: deletion arbitration stays in its menu.
  await expect(
    page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Demandes de suppression" }),
  ).toBeVisible();
});
