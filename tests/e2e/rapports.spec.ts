import { loadEnvConfig } from "@next/env";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Reporting (screens 39 and 40) against the real backend. Checks the 204 of an empty period, shown
 * as an empty state rather than an error (RG-REP-02), and permissions: the dashboard for DJ and DJA,
 * the report for any holder of `ROLE_JURISTE` (management included, through the composite role).
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
  // The nine indicators of the screen, each with its value (the development database is not
  // empty). No success rate: management wants counts.
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
   * N6: the three counts do not derive from one another (a mixed decision is neither won nor lost),
   * and the screen must say so.
   */
  await expect(
    dj.getByText("Ce n’est pas le complément des gagnés : les décisions mixtes sont comptées à part."),
  ).toBeVisible();

  // Journey P9 continues: the DJ reaches the report through the composite ROLE_JURISTE.
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
  // The entry is not offered in the navigation either.
  await expect(
    assistante.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Tableau de bord" }),
  ).toHaveCount(0);
  await assistante.context().close();
});

test("un rapport se compile sur la période choisie, et une période vide reste un état vide", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/rapports");
  await expect(page.getByRole("heading", { name: "Rapport d’activité", level: 1 })).toBeVisible();

  // Nothing is sent before the click: the report is an action, not a screen read.
  await expect(page.getByText("Choisissez une période, puis affichez le rapport.")).toBeVisible();

  // Wide period: the development database has activity.
  await page.locator("#rapport-debut").fill("2020-01-01");
  await page.locator("#rapport-fin").fill("2030-12-31");
  await page.getByRole("button", { name: "Afficher le rapport" }).click();
  await expect(page.getByText("Dossiers ouverts")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Délibérés rendus")).toBeVisible();
  /*
   * Counts, not a percentage: the report shows the three counts instead of a recovery success rate.
   */
  await expect(page.getByText("Litiges gagnés")).toBeVisible();
  await expect(page.getByText("Litiges perdus")).toBeVisible();
  await expect(page.getByText("Décisions mixtes")).toBeVisible();
  await expect(page.getByText("Succès du recouvrement")).toHaveCount(0);

  // RG-REP-02: a period without activity returns 204, shown as an empty state, not an error.
  await page.locator("#rapport-debut").fill("2000-01-01");
  await page.locator("#rapport-fin").fill("2000-01-02");
  await page.getByRole("button", { name: "Afficher le rapport" }).click();
  await expect(page.getByText("Aucune activité sur cette période")).toBeVisible({ timeout: 30_000 });
  // No error state: `role="alert"` is searched inside the content, as Next's route announcer also
  // has one, outside `<main>`.
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
    // Name built by the screen: the Content-Disposition header is not exposed through CORS.
    expect(fichier.suggestedFilename()).toMatch(new RegExp(`\\.${extension}$`));
  }

  await page.context().close();
});

test("l'Assistante et le SH atteignent le rapport d'activité, sans les activités nominatives", async ({ browser }) => {
  for (const identifiant of ["assistante.test", "sh.test"]) {
    const page = await pageConnectee(browser, identifiant);
    await page.goto("/rapports");
    await expect(page.getByRole("heading", { name: "Rapport d’activité", level: 1 })).toBeVisible();
    // Reports naming people stay with management.
    await expect(page.getByRole("heading", { name: "Activité par personne" })).toHaveCount(0);
    await expect(page.locator("#nominatif-debut")).toHaveCount(0);
    await page.context().close();
  }
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
 * Activity per person (N6), REC-E2E-036.
 * 1. Visibility: the report names colleagues, so it is restricted to DJ and DJA on their own roles
 *    (`ROLE_JURISTE` is composite and would give it to every legal officer).
 * 2. Indicators, not a grade: no percentage, score or ranking by volume.
 * 3. An empty period returns 204, shown as an empty state (RG-REP-02).
 */
const BORNES_LARGES = ["2020-01-01", "2030-12-31"] as const;

/** The two fields of the per-person screen; the periodic report has its own, `#rapport-*`. */
async function posePeriodeNominative(page: Page, debut: string, fin: string) {
  await page.locator("#nominatif-debut").fill(debut);
  await page.locator("#nominatif-fin").fill(fin);
  /*
   * By accessible name, not visible text: two tables on this screen both have a "Afficher" button.
   */
  await page.getByRole("button", { name: "Afficher l’activité par personne" }).click();
}

test("le DJ lit l'activité de chacun, et une période vide y reste un état vide", async ({ browser }) => {
  const dj = await pageConnectee(browser, "dj.test");
  await dj.goto("/rapports");
  await expect(dj.getByRole("heading", { name: "Activité par personne", level: 2 })).toBeVisible();

  /*
   * Nothing is sent or shown before the click: the report names people. Two blocks carry this
   * sentence (internal staff and lawyers), and neither triggers on its own.
   */
  await expect(dj.getByText("Choisissez une période, puis affichez.", { exact: true })).toHaveCount(2);

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
   * Indicators, not a grade: a percentage here would be an individual success rate.
   */
  expect(await tableau.innerText()).not.toContain("%");

  /*
   * Sorted by name: sorting by volume would turn the report into a ranking.
   */
  const personnes = await tableau.locator("tbody tr td:nth-child(1)").allInnerTexts();
  const nomsSeuls = personnes.map((cellule) => cellule.split("\n")[0].trim());
  expect(nomsSeuls).toEqual([...nomsSeuls].sort((a, b) => a.localeCompare(b, "fr")));

  // RG-REP-02: a period without activity returns 204, shown as an empty state, not an error.
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
   * The sensitive point: the legal officer, DJ and DJA all reach `/rapports` through the same role,
   * and the URL does not distinguish them. The section must be missing for the legal officer
   * without removing anything else.
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
  await expect(page.getByRole("button", { name: "Show activity by person" })).toBeVisible();
});

/**
 * Activity sheet, REC-E2E-037: download one's own report for the chosen period, and click an item
 * to reach the task details. The sheet lives on "Mon compte" so the Assistant and the SH, who
 * cannot enter `/rapports`, can reach it.
 */
async function afficherMonActivite(page: Page) {
  await page.goto("/mon-compte");
  await expect(page.getByRole("heading", { name: "Mon activité", level: 2 })).toBeVisible();
  await page.locator("#activite-debut-moi").fill("2020-01-01");
  await page.locator("#activite-fin-moi").fill("2030-12-31");
  await page.getByRole("button", { name: "Afficher mon activité" }).click();
}

test("un juriste affiche son activité, la télécharge, puis clique jusqu'au dossier", async ({ page }) => {
  await seConnecter(page, "juriste.test");

  // Nothing before the click: the sheet names a person, it does not trigger on opening.
  await page.goto("/mon-compte");
  await expect(page.getByText("Choisissez une période, puis affichez.", { exact: true })).toBeVisible();
  // Download is not offered before: a document is not taken away unseen.
  await expect(page.getByRole("button", { name: "Télécharger" })).toHaveCount(0);

  await afficherMonActivite(page);
  const tableau = page.getByRole("table", { name: /Activité du/ });
  await expect(tableau).toBeVisible({ timeout: 30_000 });
  await expect(tableau.getByRole("columnheader", { name: "Nature de l’action" })).toBeVisible();
  await expect(tableau.locator("tbody tr").first()).toBeVisible();

  // No grade, no score.
  expect(await tableau.innerText()).not.toContain("%");

  /*
   * Each user can download their own reports: three formats, and a file name with the person and
   * the period (built client-side too, as the header is not exposed through CORS).
   */
  for (const [format, extension] of [
    ["PDF", "pdf"],
    ["Excel", "xlsx"],
    ["CSV", "csv"],
  ] as const) {
    await page.locator("#activite-format-moi").selectOption({ label: format });
    const telechargement = page.waitForEvent("download");
    await page.getByRole("button", { name: "Télécharger" }).click();
    const fichier = await telechargement;
    expect(fichier.suggestedFilename()).toMatch(
      new RegExp(`^activite-.+-2020-01-01_2030-12-31\\.${extension}$`),
    );
  }

  /*
   * Clicking an item leads to the task details: a count opens the counted actions; an action opens
   * the related case.
   */
  await tableau.getByRole("button", { name: /^Voir les \d+ actions - / }).first().click();
  const modale = page.getByRole("dialog");
  await expect(modale).toBeVisible();
  await expect(modale.getByRole("columnheader", { name: "Dossier" })).toBeVisible();

  const versDossier = modale.getByRole("link", { name: /^Ouvrir le dossier / }).first();
  await expect(versDossier).toBeVisible({ timeout: 30_000 });
  await versDossier.click();
  await page.waitForURL(/\/dossiers\/\d+/, { timeout: 60_000 });
  // Lands on the case page, not an error page.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  /*
   * And on a tab that exists: an unknown tab silently falls back to the summary.
   */
  const onglet = new URL(page.url()).searchParams.get("onglet");
  if (onglet !== null) {
    expect([
      "synthese",
      "etapes",
      "audiences",
      "deliberes",
      "alarmes",
      "decisions",
      "historique",
      "documents",
      "publications",
    ]).toContain(onglet);
  }

  await page.context().close();
});

/**
 * The Assistant and the SH read their own activity sheet in "Mon compte", like every internal profile.
 */
test("l'Assistante et le SH ont leur fiche, là où ils peuvent l'atteindre", async ({ browser }) => {
  for (const identifiant of ["assistante.test", "sh.test"]) {
    const page = await pageConnectee(browser, identifiant);
    await page.goto("/mon-compte");
    await expect(page.getByRole("heading", { name: "Mon activité", level: 2 })).toBeVisible();
    await page.locator("#activite-debut-moi").fill("2020-01-01");
    await page.locator("#activite-fin-moi").fill("2030-12-31");
    await page.getByRole("button", { name: "Afficher mon activité" }).click();
    /*
     * Faithful, not comparable: the management table has six production columns, none of which is
     * the SH's job. Their sheet shows what they did, or an empty state, never a page of zeros.
     */
    await expect(
      page.getByRole("table", { name: /Activité du/ }).or(page.getByText("Aucune activité sur cette période")),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    await page.context().close();
  }
});

test("une période sans activité reste un état vide, et une période inversée est refusée", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/mon-compte");

  await page.locator("#activite-debut-moi").fill("2026-12-31");
  await page.locator("#activite-fin-moi").fill("2026-01-01");
  await expect(page.getByText("La date de fin précède celle de début.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Afficher mon activité" })).toBeDisabled();

  await page.locator("#activite-debut-moi").fill("2000-01-01");
  await page.locator("#activite-fin-moi").fill("2000-01-02");
  await page.getByRole("button", { name: "Afficher mon activité" }).click();
  await expect(page.getByText("Aucune activité sur cette période")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  // No document to take away for an empty period.
  await expect(page.getByRole("button", { name: "Télécharger" })).toHaveCount(0);

  await page.context().close();
});

/**
 * Both levels meet here: the DJ compares six columns, then opens a person's name to see everything
 * they did.
 */
test("le DJ ouvre la fiche complète d'un collègue depuis son nom", async ({ page }) => {
  await seConnecter(page, "dj.test");
  await page.goto("/rapports");
  await posePeriodeNominative(page, ...BORNES_LARGES);

  const tableau = page.getByRole("table", { name: /Activité par personne du/ });
  await expect(tableau).toBeVisible({ timeout: 30_000 });
  const premier = tableau.locator("tbody tr td:nth-child(1) button").first();
  const nom = (await premier.innerText()).trim();
  await premier.click();

  await expect(page.getByRole("heading", { name: `Activité de ${nom}`, level: 2 })).toBeVisible();
  // The colleague's sheet has its own date fields, distinct from "Mon activité": two blocks on
  // the same screen cannot share their ids.
  await expect(page.locator("#activite-debut-moi")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Fermer la fiche" })).toBeVisible();

  await page.getByRole("button", { name: "Fermer la fiche" }).click();
  await expect(page.getByRole("heading", { name: `Activité de ${nom}`, level: 2 })).toHaveCount(0);

  await page.context().close();
});

/**
 * Menu entry for the activity sheet: the user name in the header is hidden below 640 px, so the
 * page must be reachable through the navigation on narrow screens.
 */
test("chaque profil interne trouve « Mon compte » dans le menu ; l'avocat non", async ({ browser }) => {
  for (const identifiant of ["juriste.test", "assistante.test", "sh.test", "dj.test", "dja.test"]) {
    const page = await pageConnectee(browser, identifiant);
    const entree = page
      .getByRole("navigation", { name: "Navigation principale" })
      .getByRole("link", { name: "Mon compte" });
    await expect(entree).toBeVisible();
    await entree.click();
    await page.waitForURL(/\/mon-compte/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Mon activité", level: 2 })).toBeVisible();
    await page.context().close();
  }

  // The lawyer does not hold ROLE_CONSULTATION: neither the entry nor the page.
  const avocat = await pageConnectee(browser, "avocat.test");
  await expect(
    avocat.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Mon compte" }),
  ).toHaveCount(0);
  await avocat.goto("/mon-compte");
  await expect(avocat.getByRole("heading", { name: "Vous n’avez pas les droits nécessaires" })).toBeVisible();
  await avocat.context().close();
});

test("la fiche d'activité est traduite", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/mon-compte");
  await expect(page.getByRole("heading", { name: "Mon activité", level: 2 })).toBeVisible();

  await page.getByRole("button", { name: "en", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My activity", level: 2 })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "Show my activity" })).toBeVisible();
});

/**
 * A lawyer's activity, REC-E2E-038. The lawyer files expense requests, hearing reports, other
 * publications and answers to explanation requests. Checks that the lawyer reaches their sheet on
 * their own screen, that detail rows offer no link to a case they cannot open, and that management
 * reaches it from the directory.
 */
test("un avocat lit et télécharge sa propre activité, sans lien vers les dossiers", async ({ page }) => {
  await seConnecter(page, "avocat.test");
  await page.goto("/portail");
  await expect(page.getByRole("heading", { name: "Mon activité", level: 2 })).toBeVisible();

  await page.locator("#activite-debut-moi").fill("2020-01-01");
  await page.locator("#activite-fin-moi").fill("2030-12-31");
  await page.getByRole("button", { name: "Afficher mon activité" }).click();

  const tableau = page.getByRole("table", { name: /Activité du/ });
  await expect(tableau).toBeVisible({ timeout: 30_000 });
  await expect(tableau.locator("tbody tr").first()).toBeVisible();
  // No grade, no score, for them as for the others.
  expect(await tableau.innerText()).not.toContain("%");

  // They download their own sheet, in the three formats.
  for (const [format, extension] of [
    ["PDF", "pdf"],
    ["Excel", "xlsx"],
    ["CSV", "csv"],
  ] as const) {
    await page.locator("#activite-format-moi").selectOption({ label: format });
    const telechargement = page.waitForEvent("download");
    await page.getByRole("button", { name: "Télécharger" }).click();
    const fichier = await telechargement;
    expect(fichier.suggestedFilename()).toMatch(
      new RegExp(`^activite-.+-2020-01-01_2030-12-31\\.${extension}$`),
    );
  }

  /*
   * No link to a case: the lawyer has no case page, and a link would lead to a permission refusal.
   * The reference is enough.
   */
  await tableau.getByRole("button", { name: /^Voir les \d+ actions - / }).first().click();
  const modale = page.getByRole("dialog");
  await expect(modale).toBeVisible();
  await expect(modale.getByRole("columnheader", { name: "Dossier" })).toBeVisible();
  await expect(modale.getByRole("link")).toHaveCount(0);

  await page.context().close();
});

test("l'avocat n'atteint ni Mon compte, ni l'activité d'un confrère", async ({ page }) => {
  await seConnecter(page, "avocat.test");

  // "Mon compte" also holds "Ma signature", meaningless for them: neither entry nor page.
  await expect(
    page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Mon compte" }),
  ).toHaveCount(0);
  await page.goto("/mon-compte");
  await expect(page.getByRole("heading", { name: "Vous n’avez pas les droits nécessaires" })).toBeVisible();

  // The directory, from which management opens a lawyer's activity, stays closed to them.
  await page.goto("/repertoire/avocats");
  await expect(page.getByRole("heading", { name: "Vous n’avez pas les droits nécessaires" })).toBeVisible();

  await page.context().close();
});

/**
 * Management reaches a lawyer's activity from the directory, next to their workload and won
 * deliberations, when assigning a case.
 */
test("le DJ ouvre l'activité d'un avocat depuis le répertoire ; le juriste n'en a pas la possibilité", async ({
  browser,
}) => {
  const dj = await pageConnectee(browser, "dj.test");
  await dj.goto("/repertoire/avocats");
  await expect(dj.locator("tbody tr").first()).toBeVisible({ timeout: 30_000 });

  const ligne = dj.locator("tbody tr").first();
  const nom = (await ligne.locator("td:nth-child(1)").innerText()).trim();
  await ligne.getByRole("button", { name: "Voir son activité" }).click();

  await expect(dj.getByRole("heading", { name: `Activité de ${nom}`, level: 2 })).toBeVisible();
  await expect(dj.getByRole("button", { name: "Fermer l’activité" })).toBeVisible();
  await dj.getByRole("button", { name: "Fermer l’activité" }).click();
  await expect(dj.getByRole("heading", { name: `Activité de ${nom}`, level: 2 })).toHaveCount(0);
  await dj.context().close();

  /*
   * The legal officer and the Assistant reach this directory to choose a lawyer, but a named
   * person's activity stays with management: the column does not exist for them.
   */
  for (const identifiant of ["juriste.test", "assistante.test", "sh.test"]) {
    const page = await pageConnectee(browser, identifiant);
    await page.goto("/repertoire/avocats");
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("columnheader", { name: "Activité" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Voir son activité" })).toHaveCount(0);
    await page.context().close();
  }
});

test("la fiche d'activité de l'avocat est traduite", async ({ page }) => {
  await seConnecter(page, "avocat.test");
  await page.goto("/portail");
  await expect(page.getByRole("heading", { name: "Mon activité", level: 2 })).toBeVisible();

  await page.getByRole("button", { name: "en", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My activity", level: 2 })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "Show my activity" })).toBeVisible();
});

/**
 * Lawyer comparison table, complementing REC-E2E-038. Internal production columns do not apply to
 * lawyers (they file, the legal officer records), hence two tables on the same screen, each with
 * its own columns.
 */
test("le DJ lit les deux tableaux : les internes, puis les avocats", async ({ page }) => {
  await seConnecter(page, "dj.test");
  await page.goto("/rapports");

  // Both blocks coexist and stay distinct.
  await expect(page.getByRole("heading", { name: "Activité par personne", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Activité des avocats", level: 2 })).toBeVisible();

  // Nothing before the click: both tables name people.
  await expect(page.getByText("Choisissez une période, puis affichez.", { exact: true })).toHaveCount(2);

  await page.locator("#avocats-debut").fill("2020-01-01");
  await page.locator("#avocats-fin").fill("2030-12-31");
  await page.getByRole("button", { name: "Afficher l’activité des avocats" }).click();

  const tableau = page.getByRole("table", { name: /Activité des avocats du/ });
  await expect(tableau).toBeVisible({ timeout: 30_000 });
  /*
   * Its columns reflect what a lawyer does, and none matches the internal table.
   */
  for (const colonne of [
    "Avocat",
    "Comptes rendus déposés",
    "Demandes de frais déposées",
    "Autres publications",
    "Explications fournies",
  ]) {
    await expect(tableau.getByRole("columnheader", { name: colonne })).toBeVisible();
  }
  await expect(tableau.getByRole("columnheader", { name: "Dossiers ouverts" })).toHaveCount(0);
  await expect(tableau.locator("tbody tr").first()).toBeVisible();
  expect(await tableau.innerText()).not.toContain("%");

  // By name, like internal staff: a busy lawyer is not a deserving one.
  const noms = await tableau.locator("tbody tr td:nth-child(1)").allInnerTexts();
  const premiers = noms.map((cellule) => cellule.split("\n")[0].trim());
  expect(premiers).toEqual([...premiers].sort((a, b) => a.localeCompare(b, "fr")));

  // Their name opens their full sheet, as for a colleague.
  const nom = premiers[0]!;
  await tableau.locator("tbody tr td:nth-child(1) button").first().click();
  await expect(page.getByRole("heading", { name: `Activité de ${nom}`, level: 2 })).toBeVisible();

  await page.context().close();
});

test("une période sans dépôt laisse le tableau des avocats sur un état vide", async ({ page }) => {
  await seConnecter(page, "dja.test");
  await page.goto("/rapports");

  await page.locator("#avocats-debut").fill("2026-12-31");
  await page.locator("#avocats-fin").fill("2026-01-01");
  await expect(page.getByText("La date de fin précède celle de début.")).toBeVisible();

  await page.locator("#avocats-debut").fill("2000-01-01");
  await page.locator("#avocats-fin").fill("2000-01-02");
  await page.getByRole("button", { name: "Afficher l’activité des avocats" }).click();
  await expect(page.getByText("Aucun dépôt sur cette période")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);

  await page.context().close();
});

test("le juriste ne voit aucun des deux tableaux nominatifs", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/rapports");

  await expect(page.getByRole("heading", { name: "Rapport d’activité", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Activité par personne" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Activité des avocats" })).toHaveCount(0);
  await expect(page.locator("#avocats-debut")).toHaveCount(0);
});

test("le tableau des avocats est traduit", async ({ page }) => {
  await seConnecter(page, "dj.test");
  await page.goto("/rapports");
  await expect(page.getByRole("heading", { name: "Activité des avocats", level: 2 })).toBeVisible();

  await page.getByRole("button", { name: "en", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lawyer activity", level: 2 })).toBeVisible({
    timeout: 30_000,
  });
});

/**
 * Dashboard block details, REC-E2E-039: all nine blocks open, a row leads to its page, and the
 * total in the dialog matches the block.
 */
const BLOCS_DU_TABLEAU = [
  "Dossiers actifs",
  "Affaires vidées",
  "Audiences planifiées",
  "Frais en attente",
  "Alertes de prorogation",
  "Litiges gagnés",
  "Litiges perdus",
  "Décisions mixtes",
  "Provisions reprises",
] as const;

test("les neuf blocs du tableau de bord s'ouvrent tous sur leur détail", async ({ page }) => {
  await seConnecter(page, "dj.test");
  await page.goto("/tableau-de-bord");
  await expect(page.getByRole("heading", { name: "Tableau de bord", level: 1 })).toBeVisible();

  for (const libelle of BLOCS_DU_TABLEAU) {
    const ouvrir = page.getByRole("button", { name: `Voir le détail de « ${libelle} »` });
    await expect(ouvrir, `le bloc « ${libelle} » n'offre pas son détail`).toBeVisible();
    await ouvrir.click();

    const modale = page.getByRole("dialog");
    await expect(modale).toBeVisible();
    // The title repeats the clicked word: otherwise nine dialogs look alike.
    await expect(modale.getByRole("heading", { name: libelle })).toBeVisible({ timeout: 30_000 });
    // Either rows or an empty state, never an error.
    await expect(
      modale.getByRole("table").or(modale.getByText("Rien à afficher.")),
    ).toBeVisible({ timeout: 30_000 });
    await expect(modale.getByRole("alert")).toHaveCount(0);

    await modale.getByRole("button", { name: "Fermer" }).click();
    await expect(modale).toBeHidden();
  }

  await page.context().close();
});

test("une ligne du détail mène à la fiche du dossier, sur l'onglet qui correspond", async ({ page }) => {
  await seConnecter(page, "dj.test");
  await page.goto("/tableau-de-bord");

  await page.getByRole("button", { name: "Voir le détail de « Dossiers actifs »" }).click();
  const modale = page.getByRole("dialog");
  await expect(modale.getByRole("table")).toBeVisible({ timeout: 30_000 });

  const versDossier = modale.getByRole("link", { name: /^Ouvrir le dossier / }).first();
  await expect(versDossier).toBeVisible();
  await versDossier.click();
  await page.waitForURL(/\/dossiers\/\d+/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  /*
   * The target tab must exist: an unknown tab silently falls back to the summary.
   */
  const onglet = new URL(page.url()).searchParams.get("onglet");
  if (onglet !== null) {
    expect([
      "synthese",
      "etapes",
      "audiences",
      "deliberes",
      "alarmes",
      "decisions",
      "historique",
      "documents",
      "publications",
    ]).toContain(onglet);
  }

  await page.context().close();
});

/**
 * Details explain what the block label does not, without the former recovery-only restriction: the
 * category scope is now chosen at the top of the screen. The alerts note remains: a row there is an
 * alert sent, not a case.
 */
test("le détail dit ce qu'une ligne représente, sans plus parler de périmètre", async ({ page }) => {
  await seConnecter(page, "dja.test");
  await page.goto("/tableau-de-bord");

  await page.getByRole("button", { name: "Voir le détail de « Litiges gagnés »" }).click();
  const modale = page.getByRole("dialog");
  await expect(
    modale.getByRole("table").or(modale.getByText("Rien à afficher.")),
  ).toBeVisible({ timeout: 30_000 });
  // The note is gone with the selector: the scope is stated at the source.
  await expect(modale.getByText("Ce décompte ne porte que sur les dossiers de recouvrement.")).toHaveCount(0);
  await modale.getByRole("button", { name: "Fermer" }).click();

  await page.getByRole("button", { name: "Voir le détail de « Alertes de prorogation »" }).click();
  await expect(page.getByRole("dialog").getByText(/Une ligne par alerte envoyée/)).toBeVisible({
    timeout: 30_000,
  });

  await page.context().close();
});

test("le juriste n'atteint pas le détail, faute d'atteindre le tableau de bord", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/tableau-de-bord");

  await expect(page.getByRole("heading", { name: "Vous n’avez pas les droits nécessaires" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Voir le détail de / })).toHaveCount(0);
});

test("le détail du tableau de bord est traduit", async ({ page }) => {
  await seConnecter(page, "dj.test");
  await page.goto("/tableau-de-bord");

  await page.getByRole("button", { name: "en", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "View details of “Active case files”" }).click();
  const modale = page.getByRole("dialog");
  await expect(modale).toBeVisible();
  await expect(
    modale.getByRole("table").or(modale.getByText("Nothing to show.")),
  ).toBeVisible({ timeout: 30_000 });
});

/**
 * Category scope, REC-E2E-040. Invariant: Recouvrement + Litiges d'exploitation = Toutes
 * catégories, for all nine indicators. An integration test checks it against the database; this
 * journey checks it through the screen.
 */
const BLOCS_MESURES = [
  "Dossiers actifs",
  "Affaires vidées",
  "Audiences planifiées",
  "Frais en attente",
  "Alertes de prorogation",
  "Litiges gagnés",
  "Litiges perdus",
  "Décisions mixtes",
] as const;

/** Dashboard block values, read in display order. */
async function valeursDesBlocs(page: Page): Promise<Record<string, number>> {
  const valeurs: Record<string, number> = {};
  for (const libelle of BLOCS_MESURES) {
    const bloc = page.locator("div").filter({
      has: page.getByRole("term").filter({ hasText: new RegExp(`^${libelle}$`) }),
    });
    const texte = await bloc.first().getByRole("definition").first().innerText();
    valeurs[libelle] = Number.parseInt(texte.replace(/[^\d]/g, ""), 10) || 0;
  }
  return valeurs;
}

async function choisirPerimetre(page: Page, option: string) {
  await page.locator("#tdb-perimetre").selectOption({ label: option });
  // The scope lives in the URL: wait for it, otherwise the previous figures are read.
  await expect(page.getByRole("heading", { name: "Tableau de bord", level: 1 })).toBeVisible();
}

test("les deux catégories s'additionnent pour faire le total, à l'écran", async ({ page }) => {
  await seConnecter(page, "dj.test");
  await page.goto("/tableau-de-bord");

  // The default is "Toutes catégories".
  await expect(page.locator("#tdb-perimetre")).toHaveValue("");

  const toutes = await valeursDesBlocs(page);

  await choisirPerimetre(page, "Recouvrement");
  await expect(page).toHaveURL(/categorie=RECOUVREMENT/);
  const recouvrement = await valeursDesBlocs(page);

  await choisirPerimetre(page, "Litiges d’exploitation");
  await expect(page).toHaveURL(/categorie=EXPLOITATION_LITIGES/);
  const exploitation = await valeursDesBlocs(page);

  /*
   * The invariant, block by block. If it fails, a query has missed its join on the case.
   */
  for (const libelle of BLOCS_MESURES) {
    expect(
      recouvrement[libelle]! + exploitation[libelle]!,
      `« ${libelle} » : ${recouvrement[libelle]} + ${exploitation[libelle]} devrait faire ${toutes[libelle]}`,
    ).toBe(toutes[libelle]);
  }

  await page.context().close();
});

/**
 * The three litigation counters are no longer fixed on recovery; the recovery figure stays
 * available under the "Recouvrement" scope.
 */
test("le détail d'un bloc suit le périmètre choisi", async ({ page }) => {
  await seConnecter(page, "dj.test");
  await page.goto("/tableau-de-bord?categorie=RECOUVREMENT");
  await expect(page.locator("#tdb-perimetre")).toHaveValue("RECOUVREMENT");

  await page.getByRole("button", { name: "Voir le détail de « Dossiers actifs »" }).click();
  const modale = page.getByRole("dialog");
  await expect(modale).toBeVisible();
  await expect(
    modale.getByRole("table").or(modale.getByText("Rien à afficher.")),
  ).toBeVisible({ timeout: 30_000 });

  /*
   * The recovery-only note is gone: the selector states the scope.
   */
  await expect(modale.getByText("Ce décompte ne porte que sur les dossiers de recouvrement.")).toHaveCount(0);

  await page.context().close();
});

test("le périmètre se partage par l'URL et survit au rechargement", async ({ page }) => {
  await seConnecter(page, "dja.test");
  await page.goto("/tableau-de-bord?categorie=EXPLOITATION_LITIGES");

  await expect(page.locator("#tdb-perimetre")).toHaveValue("EXPLOITATION_LITIGES");
  await page.reload();
  // A reload must not return to "toutes catégories" unrequested.
  await expect(page.locator("#tdb-perimetre")).toHaveValue("EXPLOITATION_LITIGES");

  await page.context().close();
});

/**
 * The periodic report follows the same scope, so the screen and the PDF mean the same thing by
 * "Litiges gagnés". The file name carries the scope too.
 */
test("le rapport périodique porte le périmètre, jusque dans le nom du fichier", async ({ page }) => {
  await seConnecter(page, "dj.test");
  await page.goto("/rapports");

  await expect(page.locator("#rapport-perimetre")).toHaveValue("");
  await page.locator("#rapport-perimetre").selectOption({ label: "Recouvrement" });
  await page.locator("#rapport-debut").fill("2020-01-01");
  await page.locator("#rapport-fin").fill("2030-12-31");
  await page.getByRole("button", { name: "Afficher le rapport" }).click();
  await expect(page.getByText("Litiges gagnés")).toBeVisible({ timeout: 30_000 });

  await page.locator("#format-export").selectOption("EXCEL");
  const telechargement = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter" }).click();
  const fichier = await telechargement;
  expect(fichier.suggestedFilename()).toBe(
    "rapport-mensuel-recouvrement-2020-01-01_2030-12-31.xlsx",
  );

  await page.context().close();
});

test("le sélecteur de périmètre est traduit", async ({ page }) => {
  await seConnecter(page, "dj.test");
  await page.goto("/tableau-de-bord");

  await page.getByRole("button", { name: "en", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByLabel("Scope", { exact: true })).toBeVisible();
  await page.locator("#tdb-perimetre").selectOption({ label: "Debt recovery" });
  await expect(page).toHaveURL(/categorie=RECOUVREMENT/);
});
