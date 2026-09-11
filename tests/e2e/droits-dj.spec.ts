import { expect, test, type Page } from "@playwright/test";

/**
 * Q-81 / QF-36 — le DJ et la DJA ont « tous les droits d'un juriste, plus les leurs » : le realm leur
 * donne `ROLE_JURISTE` en rôle composite. On vérifie ici, **contre Keycloak et le backend réels**,
 * que le jeton du DJ ouvre bien les actions de juriste, sans lui faire perdre son profil ni les
 * siennes.
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

test("le DJ agit en juriste — étape et audience — sans cesser d'être DJ", async ({ page }) => {
  await seConnecter(page, "dj.test");
  // Son profil affiché reste celui du DJ, malgré le rôle juriste qu'il porte désormais.
  await expect(page.getByRole("banner").getByText("Directeur Juridique", { exact: true })).toBeVisible();

  await page.goto("/dossiers/nouveau");
  await page.getByLabel("Référence", { exact: true }).fill(`DOS-DJ-${suffixe()}`);
  await page.getByLabel("Nature du dossier", { exact: true }).selectOption("Assignation en paiement");
  await page.getByLabel("Juridiction saisie", { exact: true }).fill("TGI Douala");
  await page.getByLabel("Client", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Risque encouru (FCFA)", { exact: true }).fill("5000000");
  await page.getByLabel("Dossier de crédit d’origine", { exact: true }).fill("CRD-DJ");
  await page.getByLabel("PV de transfert", { exact: true }).fill("PV-DJ");
  await page.getByLabel("Juristes affectés", { exact: true }).selectOption({ index: 0 });
  await page.getByLabel("Avocats affectés", { exact: true }).selectOption({ index: 0 });
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/dossiers\/\d+$/, { timeout: 60_000 });

  // Gérer les étapes : réservé à ROLE_JURISTE, que le DJ porte désormais.
  await page.getByRole("tab", { name: "Étapes" }).click();
  await page.getByLabel("Faire passer à", { exact: true }).selectOption("EN_COURS");
  await page.getByRole("button", { name: "Appliquer" }).click();
  await expect(page.getByText("Statut de l’étape mis à jour.")).toBeVisible();

  // Planifier une audience : idem.
  await page.getByRole("tab", { name: "Audiences" }).click();
  await page.getByRole("button", { name: "Planifier une audience" }).click();
  await page.getByLabel("Date de l’audience", { exact: true }).fill(dansJours(9));
  await page.getByRole("dialog", { name: "Planifier une audience" }).getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Planifiée" })).toHaveCount(1);

  // Et ses propres droits demeurent : l'arbitrage des suppressions reste dans son menu.
  await expect(
    page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Demandes de suppression" }),
  ).toBeVisible();
});
