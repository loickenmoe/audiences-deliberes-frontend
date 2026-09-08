import { expect, test } from "@playwright/test";

/**
 * Jalon F1 : on ne vérifie que ce qui existe — le socle se rend, la page inconnue renvoie 404.
 * Les parcours métier (P1 à P9) arrivent avec les écrans correspondants.
 */
test("la page d'accueil se rend", async ({ page }) => {
  await page.goto("/");
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
