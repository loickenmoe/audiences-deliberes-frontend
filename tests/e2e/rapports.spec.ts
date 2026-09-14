import { loadEnvConfig } from "@next/env";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Reporting (écrans 39 et 40) **contre le backend réel**.
 *
 * Deux points méritent d'être tenus par un parcours : le **204 d'une période vide**, qui doit
 * s'afficher comme un état vide et non comme une erreur (RG-REP-02), et les habilitations — le
 * tableau de bord au DJ et à la DJA (Q-95), le rapport à tout porteur de `ROLE_JURISTE`, ce qui
 * inclut la direction depuis Q-81.
 */

loadEnvConfig(process.cwd());

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

test("le DJ lit ses indicateurs et rejoint les rapports depuis le tableau de bord", async ({ browser }) => {
  const dj = await pageConnectee(browser, "dj.test");
  await dj
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("link", { name: "Tableau de bord" })
    .click();
  await dj.waitForURL(/\/tableau-de-bord/, { timeout: 60_000 });

  await expect(dj.getByRole("heading", { name: "Tableau de bord", level: 1 })).toBeVisible();
  // Les six indicateurs du contrat, chacun avec sa valeur — la base de développement n'est pas vide.
  for (const libelle of [
    "Dossiers actifs",
    "Audiences planifiées",
    "Frais en attente",
    "Alertes de prorogation",
    "Succès du recouvrement",
    "Provisions reprises",
  ]) {
    await expect(dj.getByRole("term").filter({ hasText: libelle })).toBeVisible();
  }
  await expect(dj.getByText("Dossiers portant au moins une étape en cours.")).toBeVisible();

  // Le parcours P9 s'enchaîne : le DJ passe au rapport par son composite ROLE_JURISTE (Q-81).
  await dj.getByRole("link", { name: "Générer un rapport" }).click();
  await dj.waitForURL(/\/rapports/, { timeout: 60_000 });
  await expect(dj.getByRole("heading", { name: "Rapport d’activité", level: 1 })).toBeVisible();

  await dj.context().close();
});

test("la DJA accède au tableau de bord, l'Assistante non (Q-95)", async ({ browser }) => {
  const dja = await pageConnectee(browser, "dja.test");
  await dja.goto("/tableau-de-bord");
  await expect(dja.getByRole("heading", { name: "Tableau de bord", level: 1 })).toBeVisible();
  await dja.context().close();

  const assistante = await pageConnectee(browser, "assistante.test");
  await assistante.goto("/tableau-de-bord");
  await expect(
    assistante.getByRole("heading", { name: "Vous n’avez pas les droits nécessaires" }),
  ).toBeVisible();
  // Et l'entrée ne lui est pas proposée dans la navigation.
  await expect(
    assistante.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Tableau de bord" }),
  ).toHaveCount(0);
  await assistante.context().close();
});

test("un rapport se compile sur la période choisie, et une période vide reste un état vide", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/rapports");
  await expect(page.getByRole("heading", { name: "Rapport d’activité", level: 1 })).toBeVisible();

  // Rien ne part avant le clic : le rapport est une action, pas une lecture d'écran.
  await expect(page.getByText("Choisissez une période, puis affichez le rapport.")).toBeVisible();

  // Période large : la base de développement porte de l'activité.
  await page.locator("#rapport-debut").fill("2020-01-01");
  await page.locator("#rapport-fin").fill("2030-12-31");
  await page.getByRole("button", { name: "Afficher le rapport" }).click();
  await expect(page.getByText("Dossiers ouverts")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Délibérés rendus")).toBeVisible();

  // RG-REP-02 : période sans activité → 204, affiché comme un état vide et non comme une erreur.
  await page.locator("#rapport-debut").fill("2000-01-01");
  await page.locator("#rapport-fin").fill("2000-01-02");
  await page.getByRole("button", { name: "Afficher le rapport" }).click();
  await expect(page.getByText("Aucune activité sur cette période")).toBeVisible({ timeout: 30_000 });
  // Aucun état d'erreur : `role="alert"` est cherché **dans le contenu**, l'annonceur de route de
  // Next en porte un lui aussi, hors de `<main>`.
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);

  await page.context().close();
});

test("une période inversée est refusée avant l'appel", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/rapports");

  await page.locator("#rapport-debut").fill("2026-12-31");
  await page.locator("#rapport-fin").fill("2026-01-01");
  await expect(page.getByText("La date de fin doit suivre la date de début.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Afficher le rapport" })).toBeDisabled();
});

test("le rapport s'exporte dans les trois formats binaires", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/rapports");
  await page.locator("#rapport-debut").fill("2020-01-01");
  await page.locator("#rapport-fin").fill("2030-12-31");

  for (const [format, extension] of [
    ["PDF", "pdf"],
    ["EXCEL", "xlsx"],
    ["CSV", "csv"],
  ] as const) {
    await page.locator("#format-export").selectOption(format);
    const telechargement = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exporter" }).click();
    const fichier = await telechargement;
    // Nom construit par l'écran : l'en-tête Content-Disposition n'est pas exposé en CORS.
    expect(fichier.suggestedFilename()).toMatch(new RegExp(`\\.${extension}$`));
  }

  await page.context().close();
});

test("l'Assistante n'atteint pas les rapports, faute de ROLE_JURISTE", async ({ page }) => {
  await seConnecter(page, "assistante.test");
  await page.goto("/rapports");

  await expect(page.getByRole("heading", { name: "Vous n’avez pas les droits nécessaires" })).toBeVisible();
});

test("les écrans de reporting sont traduits", async ({ page }) => {
  await seConnecter(page, "dj.test");
  await page.goto("/tableau-de-bord");
  await expect(page.getByRole("heading", { name: "Tableau de bord", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "en", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("term").filter({ hasText: "Active case files" })).toBeVisible();

  await page.goto("/rapports");
  await expect(page.getByRole("heading", { name: "Activity report", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show report" })).toBeVisible();
});
