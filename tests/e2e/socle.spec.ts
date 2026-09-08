import { expect, test } from "@playwright/test";

/**
 * Socle applicatif. Depuis le jalon F2, la racine est protégée : un visiteur non authentifié est
 * renvoyé vers la connexion. Les parcours d'authentification sont couverts par
 * `authentification.spec.ts` ; les parcours métier (P1 à P9) arriveront avec les écrans.
 */
test("la racine est protégée et renvoie vers la connexion", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Audiences et Délibérés" })).toBeVisible();
});

test("une route inconnue affiche la page introuvable", async ({ page }) => {
  await page.goto("/route-qui-nexiste-pas");
  await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
});

test("la langue du document est le français", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
});
