import { expect, test } from "@playwright/test";

/**
 * French / English bilingualism, checked end to end.
 *
 * The language lives in a cookie and the URL has no prefix: `/login` stays `/login` in both
 * languages. These tests check that the switch holds, including after navigation.
 */

test("l'écran de connexion s'affiche en français par défaut", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: /Bienvenue sur/ })).toBeVisible();
  await expect(page.getByLabel("Identifiant", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
});

test("la bascule vers l'anglais traduit l'écran sans changer l'URL", async ({ page }) => {
  await page.goto("/login");

  await page.getByRole("button", { name: "en", exact: true }).click();

  await expect(page.getByRole("heading", { name: /Welcome to/ })).toBeVisible();
  await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  // The URL is unchanged: deep links in notifications stay valid.
  await expect(page).toHaveURL(/\/login$/);
});

test("la langue choisie survit à la navigation", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "en", exact: true }).click();
  await expect(page.getByLabel("Username", { exact: true })).toBeVisible();

  await page.goto("/route-qui-nexiste-pas");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

  await page.goto("/unauthorized");
  await expect(
    page.getByRole("heading", { name: "You do not have the required permissions" }),
  ).toBeVisible();
});

test("les messages d'erreur de connexion sont traduits", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "en", exact: true }).click();

  await page.getByLabel("Username", { exact: true }).fill("juriste.test");
  await page.getByLabel("Password", { exact: true }).fill("mauvais-mot-de-passe");
  await page.getByRole("button", { name: "Sign in" }).click();

  // Explicit wait: the rejection comes from a real Keycloak and the message goes through a server
  // action. The default 5 s does not cover this (see `authentification.spec.ts`).
  const alerte = page.getByRole("main").getByRole("alert");
  await expect(alerte).toBeVisible({ timeout: 20_000 });
  await expect(alerte).toHaveText("Incorrect username or password.");
});

test("un juriste connecté en anglais voit son profil traduit", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "en", exact: true }).click();

  await page.getByLabel("Username", { exact: true }).fill("juriste.test");
  await page.getByLabel("Password", { exact: true }).fill("Password1!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });

  await expect(page.getByRole("heading", { name: /Hello/ })).toBeVisible();
  // The business profile is translated, not shown in French nor as a technical code.
  await expect(page.getByRole("banner").getByText("Legal Officer")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});

test("le retour au français est possible depuis l'application", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "en", exact: true }).click();
  await expect(page.getByLabel("Username", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "fr", exact: true }).click();
  await expect(page.getByLabel("Identifiant", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
});
