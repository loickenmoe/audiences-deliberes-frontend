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
  // Les neuf indicateurs de l'écran, chacun avec sa valeur — la base de développement n'est pas
  // vide. Le taux de succès n'y est plus : la Direction veut des nombres (2026-10-06).
  await expect(dj.getByRole("term").filter({ hasText: "Succès du recouvrement" })).toHaveCount(0);
  for (const libelle of [
    "Dossiers actifs",
    "Affaires vidées",
    "Audiences planifiées",
    "Frais en attente",
    "Alertes de prorogation",
    "Litiges gagnés",
    "Litiges perdus",
    "Décisions mixtes",
    "Provisions reprises",
  ]) {
    await expect(dj.getByRole("term").filter({ hasText: libelle })).toBeVisible();
  }
  await expect(dj.getByText("Dossiers portant au moins une étape en cours.")).toBeVisible();

  /*
   * N6 (observation 12) : la Direction lisait un taux sans savoir sur combien d'affaires il
   * portait. Les trois décomptes **ne se déduisent pas l'un de l'autre** - une décision mixte
   * n'est ni gagnée ni perdue - et l'écran doit le dire, pas seulement l'afficher.
   */
  await expect(
    dj.getByText("Ce n’est pas le complément des gagnés : les décisions mixtes sont comptées à part."),
  ).toBeVisible();

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
  /*
   * Des nombres, pas un pourcentage (métier, 2026-10-06). Le rapport portait une ligne
   * « Succès du recouvrement » en pourcentage ; il porte les trois décomptes qu'elle résumait.
   */
  await expect(page.getByText("Litiges gagnés")).toBeVisible();
  await expect(page.getByText("Litiges perdus")).toBeVisible();
  await expect(page.getByText("Décisions mixtes")).toBeVisible();
  await expect(page.getByText("Succès du recouvrement")).toHaveCount(0);

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

/**
 * L'activité par personne (observation 14, N6) — REC-E2E-036.
 *
 * Trois choses se tiennent ici, et aucune des trois ne se vérifie en test unitaire :
 *
 * 1. **Qui la voit.** Le rapport nomme des collègues. Il est réservé au DJ et à la DJA, et le
 *    serveur le tient sur leurs rôles propres : l'adosser à `ROLE_JURISTE`, composite depuis Q-81,
 *    le donnerait à chaque juriste, donc à chacun des nommés.
 * 2. **Des indicateurs, pas une note.** Ni pourcentage, ni score, ni classement par volume -
 *    l'application compte, le responsable apprécie. C'est la ligne arrêtée avec le métier, et un
 *    test est le seul moyen qu'elle survive à la prochaine demande de « total global ».
 * 3. **Le 204 d'une période vide**, comme pour le rapport périodique (RG-REP-02) : un état vide,
 *    pas une erreur.
 */
const BORNES_LARGES = ["2020-01-01", "2030-12-31"] as const;

/** Les deux champs de l'écran nominatif ; le rapport périodique porte les siens, `#rapport-*`. */
async function posePeriodeNominative(page: Page, debut: string, fin: string) {
  await page.locator("#nominatif-debut").fill(debut);
  await page.locator("#nominatif-fin").fill(fin);
  // « Afficher » tout court : le rapport périodique porte « Afficher le rapport ».
  await page.getByRole("button", { name: "Afficher", exact: true }).click();
}

test("le DJ lit l'activité de chacun, et une période vide y reste un état vide", async ({ browser }) => {
  const dj = await pageConnectee(browser, "dj.test");
  await dj.goto("/rapports");
  await expect(dj.getByRole("heading", { name: "Activité par personne", level: 2 })).toBeVisible();

  // Rien ne part avant le clic, et surtout rien ne s'affiche : le rapport nomme des personnes, il
  // ne se déclenche pas en ouvrant l'écran.
  await expect(dj.getByText("Choisissez une période, puis affichez.", { exact: true })).toBeVisible();

  await posePeriodeNominative(dj, ...BORNES_LARGES);
  const tableau = dj.getByRole("table", { name: /Activité par personne du/ });
  await expect(tableau).toBeVisible({ timeout: 30_000 });
  for (const colonne of [
    "Personne",
    "Dossiers ouverts",
    "Audiences planifiées",
    "Comptes rendus saisis",
    "Délibérés enregistrés",
    "Lettres rédigées",
    "Frais contrôlés",
    "Délai moyen de saisie",
  ]) {
    await expect(tableau.getByRole("columnheader", { name: colonne })).toBeVisible();
  }
  await expect(tableau.locator("tbody tr").first()).toBeVisible();

  /*
   * Des indicateurs, pas une note. Un pourcentage dans ce tableau serait un taux de réussite
   * individuel, c'est-à-dire exactement ce que le métier a refusé.
   */
  expect(await tableau.innerText()).not.toContain("%");

  /*
   * L'ordre est celui des **noms**. Trier par volume ferait du rapport un palmarès, où le premier
   * passerait pour le meilleur - alors que trente dossiers simples ne valent pas deux affaires
   * difficiles.
   */
  const personnes = await tableau.locator("tbody tr td:nth-child(1)").allInnerTexts();
  const nomsSeuls = personnes.map((cellule) => cellule.split("\n")[0].trim());
  expect(nomsSeuls).toEqual([...nomsSeuls].sort((a, b) => a.localeCompare(b, "fr")));

  // RG-REP-02 : période sans activité → 204, affiché comme un état vide et non comme une erreur.
  await posePeriodeNominative(dj, "2000-01-01", "2000-01-02");
  await expect(dj.getByText("Aucune activité sur cette période")).toBeVisible({ timeout: 30_000 });
  await expect(dj.getByRole("main").getByRole("alert")).toHaveCount(0);

  await dj.context().close();
});

test("la DJA lit l'activité par personne ; le juriste garde son rapport sans la voir", async ({ browser }) => {
  const dja = await pageConnectee(browser, "dja.test");
  await dja.goto("/rapports");
  await expect(dja.getByRole("heading", { name: "Activité par personne", level: 2 })).toBeVisible();
  await dja.context().close();

  /*
   * Le point sensible. Le juriste atteint `/rapports` par son rôle, et le DJ comme la DJA
   * l'atteignent par le même composite : rien dans l'URL ne distingue les trois. C'est la section
   * qui doit manquer au juriste, sans rien lui retirer de ce qu'il avait.
   */
  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto("/rapports");
  await expect(juriste.getByRole("heading", { name: "Rapport d’activité", level: 1 })).toBeVisible();
  await expect(juriste.getByRole("heading", { name: "Activité par personne" })).toHaveCount(0);
  await expect(juriste.locator("#nominatif-debut")).toHaveCount(0);
  await juriste.context().close();
});

test("l'activité par personne est traduite", async ({ page }) => {
  await seConnecter(page, "dja.test");
  await page.goto("/rapports");
  await expect(page.getByRole("heading", { name: "Activité par personne", level: 2 })).toBeVisible();

  await page.getByRole("button", { name: "en", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Activity by person", level: 2 })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "Show", exact: true })).toBeVisible();
});
