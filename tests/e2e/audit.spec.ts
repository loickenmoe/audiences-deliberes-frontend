import { loadEnvConfig } from "@next/env";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Audit des actions historisées (écran 43) **contre le backend réel** — backend Q-112.
 *
 * Ces parcours reprennent ceux du journal de Q-110, qui a déménagé ici : la vérification n'a pas
 * changé de nature, seulement d'écran. S'y ajoute ce que le journal ne pouvait pas couvrir — le
 * périmètre transversal, le filtre par personne, et la trace que laisse toute consultation.
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

async function ouvrirAudit(page: Page) {
  await page.goto("/admin/audit");
  await expect(page.getByRole("heading", { name: "Audit", level: 1 })).toBeVisible({ timeout: 60_000 });
}

/**
 * Les messages de critères invalides se cherchent **dans la section des filtres**. Next pose à la
 * racine du document son propre `role="alert"` pour annoncer les changements de route ; un sélecteur
 * global les confondrait — défaut rencontré deux fois avant d'être corrigé à la source.
 */
function filtres(page: Page) {
  return page.getByRole("region", { name: "Filtres de l’audit" });
}

test("l'audit couvre tout l'historique et se restreint à un périmètre choisi (Q-112)", async ({
  browser,
}) => {
  const dj = await pageConnectee(browser, "dj.test");
  await ouvrirAudit(dj);

  /*
   * On filtre sur une nature d'action plutôt que de chercher une ligne au hasard de la première
   * page : l'audit se lit du plus récent au plus ancien, et les consultations que ce test provoque
   * occupent aussitôt le haut du classement. Une première version supposait qu'une création de
   * dossier figurerait en page 1 — hypothèse sur la donnée, pas sur le comportement.
   */
  const action = dj.getByLabel("Action", { exact: true });
  await expect.poll(() => action.locator("option").count(), { timeout: 30_000 }).toBeGreaterThan(1);
  await action.selectOption({ label: "Création du dossier" });

  // Portée par défaut : tout l'historique, dossiers compris — ce que le journal ne montrait pas.
  await expect(dj.getByRole("row", { name: /Création du dossier/ }).first()).toBeVisible({
    timeout: 30_000,
  });

  // Restreinte aux actions système, la même nature ne renvoie plus rien : c'est le périmètre, et
  // lui seul, qui a changé.
  await dj.getByLabel("Portée", { exact: true }).selectOption("HORS_DOSSIER");
  await expect(dj.getByRole("row", { name: /Création du dossier/ })).toHaveCount(0, { timeout: 30_000 });

  await dj.context().close();
});

/**
 * Le filtre par personne est ce qui donne sa valeur à l'écran, et ce qui le rend sensible : il est
 * autorisé par NF-CONF-01, et c'est lui qui rend nécessaire de tracer les consultations.
 */
test("l'audit filtre par personne, et le dit à qui consulte (Q-112)", async ({ browser }) => {
  const dja = await pageConnectee(browser, "dja.test");
  await ouvrirAudit(dja);

  // L'écran annonce lui-même que la consultation est enregistrée, plutôt que de le taire.
  await expect(dja.getByText(/Votre consultation de cet écran est elle-même enregistrée/)).toBeVisible();
  // Et il énonce ce qu'il ne couvre pas : les consultations ne sont pas tracées.
  await expect(dja.getByText(/Les consultations ne sont pas tracées/)).toBeVisible();

  /*
   * L'annuaire arrive par une requête distincte : compter les options sans attendre mesurait la
   * course, pas le contenu. `expect.poll` réessaie jusqu'à ce que la liste soit peuplée.
   */
  const auteur = dja.getByLabel("Auteur", { exact: true });
  await expect.poll(() => auteur.locator("option").count(), { timeout: 30_000 }).toBeGreaterThan(1);
  await auteur.selectOption({ index: 1 });
  // Le tableau se recharge sans erreur : c'est la requête filtrée par personne qui est vérifiée.
  await expect(filtres(dja).getByRole("alert")).toHaveCount(0);

  await dja.context().close();
});

/**
 * La trace de la consultation. Elle protège le DJ et la DJA autant que ceux qu'ils consultent : elle
 * démontre qu'ils n'ont regardé que ce qu'ils devaient.
 */
test("consulter l'audit y laisse sa propre trace (Q-112)", async ({ browser }) => {
  const dj = await pageConnectee(browser, "dj.test");
  await ouvrirAudit(dj);

  await dj.getByLabel("Action", { exact: true }).selectOption({ label: "Consultation de l'audit" });
  const ligne = dj.getByRole("row", { name: /Consultation de l'audit/ }).first();
  await expect(ligne).toBeVisible({ timeout: 30_000 });
  // Les critères employés figurent dans la trace : une trace sans critères ne dirait presque rien.
  await expect(ligne).toContainText(/perimetre/);

  await dj.context().close();
});

test("une portée « un dossier » sans numéro est expliquée, pas renvoyée en erreur technique (Q-112)", async ({
  browser,
}) => {
  const dj = await pageConnectee(browser, "dj.test");
  await ouvrirAudit(dj);

  await dj.getByLabel("Portée", { exact: true }).selectOption("UN_DOSSIER");
  await expect(filtres(dj).getByRole("alert")).toContainText("numéro du dossier");

  await dj.getByLabel("N° de dossier", { exact: true }).fill("1");
  await expect(filtres(dj).getByRole("alert")).toHaveCount(0);

  await dj.getByLabel("Du", { exact: true }).fill("2026-12-31");
  await dj.getByLabel("Au", { exact: true }).fill("2026-01-01");
  await expect(filtres(dj).getByRole("alert")).toContainText("date de début est postérieure");

  await dj.context().close();
});

test("l'audit est fermé au juriste, à l'Assistante et au SH (Q-112)", async ({ browser }) => {
  for (const profil of ["juriste.test", "assistante.test", "sh.test"]) {
    const page = await pageConnectee(browser, profil);
    // Ni dans la navigation…
    await expect(
      page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Audit" }),
    ).toHaveCount(0);
    // …ni par l'URL forcée : masquer n'est pas sécuriser.
    await page.goto("/admin/audit");
    await expect(page).toHaveURL(/\/unauthorized/, { timeout: 30_000 });
    await page.context().close();
  }
});

/**
 * Le journal a quitté l'écran des paramètres, mais la question qui naît en regardant un réglage —
 * « qui l'a mis là ? » — y trouve désormais sa réponse sur place, rattachée à la ligne qui la pose.
 */
test("l'écran des paramètres porte l'auteur de la dernière modification (Q-112)", async ({
  browser,
}) => {
  const dja = await pageConnectee(browser, "dja.test");
  await dja.goto("/admin/configurations");
  await expect(dja.getByRole("heading", { name: "Paramètres système", level: 1 })).toBeVisible({
    timeout: 60_000,
  });

  // Le journal n'est plus là : deux endroits où chercher la même trace, c'est un de trop.
  await expect(dja.getByRole("heading", { name: "Journal des actions système" })).toHaveCount(0);

  const article = dja.locator("article", { hasText: "SEUIL_PROROGATIONS" });
  const champ = article.locator("#configuration-SEUIL_PROROGATIONS");
  const initiale = (await champ.inputValue()).trim();
  const nouvelle = initiale === "12" ? "13" : "12";

  try {
    await champ.fill(nouvelle);
    await article.getByRole("button", { name: "Enregistrer" }).click();
    await expect(dja.getByText("Paramètre SEUIL_PROROGATIONS enregistré.")).toBeVisible();
    // Sans rien cliquer : la ligne porte désormais le nom de qui vient de la changer.
    await expect(article).toContainText(/Modifiée le .* par /, { timeout: 30_000 });
  } finally {
    await champ.fill(initiale);
    await article.getByRole("button", { name: "Enregistrer" }).click();
    await expect(dja.getByText("Paramètre SEUIL_PROROGATIONS enregistré.")).toBeVisible();
    await dja.context().close();
  }
});
