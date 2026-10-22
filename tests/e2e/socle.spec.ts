import { expect, test } from "@playwright/test";

/**
 * Application shell. The root is protected: an unauthenticated visitor is redirected to login.
 * Authentication journeys are covered by `authentification.spec.ts`.
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
