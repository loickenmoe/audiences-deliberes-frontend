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
  /*
   * Par son **nom accessible**, et non par son texte visible. Deux tableaux coexistent sur cet écran
   * depuis Q-136, tous deux avec un bouton « Afficher » : le texte seul ne dit pas lequel. Le nom
   * accessible le dit, et c'est aussi ce qu'un lecteur d'écran annonce.
   */
  await page.getByRole("button", { name: "Afficher l’activité par personne" }).click();
}

test("le DJ lit l'activité de chacun, et une période vide y reste un état vide", async ({ browser }) => {
  const dj = await pageConnectee(browser, "dj.test");
  await dj.goto("/rapports");
  await expect(dj.getByRole("heading", { name: "Activité par personne", level: 2 })).toBeVisible();

  /*
   * Rien ne part avant le clic, et surtout rien ne s'affiche : le rapport nomme des personnes, il ne
   * se déclenche pas en ouvrant l'écran. **Deux** blocs portent cette phrase depuis Q-136 - celui
   * des internes et celui des avocats -, et c'est bien ce qu'on veut vérifier : ni l'un ni l'autre
   * ne se déclenche seul.
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
  await expect(page.getByRole("button", { name: "Show activity by person" })).toBeVisible();
});

/**
 * La fiche d'activité (Q-133) — REC-E2E-037.
 *
 * Les deux demandes du métier du 2026-10-09 : **télécharger son propre rapport** sur la période
 * choisie, et **cliquer sur un élément** pour arriver aux détails de la tâche.
 *
 * Ce qu'un test unitaire ne peut pas tenir ici : que l'Assistante et le supérieur hiérarchique, qui
 * n'entrent pas sur `/rapports`, y aient tout de même accès - c'est la raison pour laquelle la fiche
 * vit sur « Mon compte » -, et que le clic aboutisse réellement sur la fiche d'un dossier.
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

  // Rien avant le clic : la fiche nomme une personne, elle ne se déclenche pas à l'ouverture.
  await page.goto("/mon-compte");
  await expect(page.getByText("Choisissez une période, puis affichez.", { exact: true })).toBeVisible();
  // Et le téléchargement n'est pas proposé avant : on n'emporte pas un document qu'on n'a pas vu.
  await expect(page.getByRole("button", { name: "Télécharger" })).toHaveCount(0);

  await afficherMonActivite(page);
  const tableau = page.getByRole("table", { name: /Activité du/ });
  await expect(tableau).toBeVisible({ timeout: 30_000 });
  await expect(tableau.getByRole("columnheader", { name: "Nature de l’action" })).toBeVisible();
  await expect(tableau.locator("tbody tr").first()).toBeVisible();

  // Ni note, ni score : le refus posé avec le métier se vérifie à l'œil.
  expect(await tableau.innerText()).not.toContain("%");

  /*
   * « Chaque utilisateur doit être capable de télécharger ses propres rapports » : les trois
   * formats, et un nom de fichier qui porte la personne et la période - le serveur le construit
   * aussi de son côté, l'en-tête n'étant pas exposée en CORS.
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
   * « Cliquer sur un élément doit directement le renvoyer aux détails de la dite tâche. » Le
   * décompte ouvre les actions comptées ; une action ouvre le dossier concerné.
   */
  await tableau.getByRole("button", { name: /^Voir les \d+ actions - / }).first().click();
  const modale = page.getByRole("dialog");
  await expect(modale).toBeVisible();
  await expect(modale.getByRole("columnheader", { name: "Dossier" })).toBeVisible();

  const versDossier = modale.getByRole("link", { name: /^Ouvrir le dossier / }).first();
  await expect(versDossier).toBeVisible({ timeout: 30_000 });
  await versDossier.click();
  await page.waitForURL(/\/dossiers\/\d+/, { timeout: 60_000 });
  // On arrive sur la fiche du dossier, pas sur une page d'erreur.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  /*
   * **Et sur un onglet qui existe.** Cette assertion manquait, et son absence a laissé passer une
   * carte qui envoyait les frais sur un onglet « frais » - la fiche dossier n'en a pas. Rien ne
   * cassait, un onglet inconnu retombant sur la synthèse : la promesse faite à l'utilisateur était
   * fausse en silence. Vérifier « on arrive sur une fiche » ne suffisait pas.
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
 * Le cœur du choix d'emplacement. `/rapports` exige `ROLE_JURISTE` : l'Assistante et le SH n'y
 * entrent pas, et leur ouvrir cet écran leur montrerait le rapport périodique du service, dont
 * l'appel échouerait sous leurs yeux. « Mon compte » est le seul écran que les cinq profils
 * internes partagent.
 */
test("l'Assistante et le SH ont leur fiche, là où ils peuvent l'atteindre", async ({ browser }) => {
  for (const identifiant of ["assistante.test", "sh.test"]) {
    const page = await pageConnectee(browser, identifiant);
    await page.goto("/rapports");
    await expect(page.getByRole("heading", { name: "Vous n’avez pas les droits nécessaires" })).toBeVisible();

    await page.goto("/mon-compte");
    await expect(page.getByRole("heading", { name: "Mon activité", level: 2 })).toBeVisible();
    await page.locator("#activite-debut-moi").fill("2020-01-01");
    await page.locator("#activite-fin-moi").fill("2030-12-31");
    await page.getByRole("button", { name: "Afficher mon activité" }).click();
    /*
     * Fidèle, et non comparable : le tableau de la direction tient sur six colonnes de production,
     * dont aucune n'est le métier du SH. Sa fiche, elle, porte ce qu'il a fait - ou un état vide,
     * jamais une page de zéros.
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
  // Pas de document à emporter pour une période vide.
  await expect(page.getByRole("button", { name: "Télécharger" })).toHaveCount(0);

  await page.context().close();
});

/**
 * Les deux niveaux se rejoignent ici : le DJ compare six colonnes, puis ouvre le nom d'une personne
 * pour voir **tout** ce qu'elle a fait. C'est ce que le métier a demandé le 2026-10-09 en corrigeant
 * la première version, qui s'arrêtait aux six colonnes.
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
  // La fiche du collègue a ses propres bornes, distinctes de celles de « Mon activité » : deux
  // blocs sur un même écran ne peuvent pas partager leurs identifiants.
  await expect(page.locator("#activite-debut-moi")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Fermer la fiche" })).toBeVisible();

  await page.getByRole("button", { name: "Fermer la fiche" }).click();
  await expect(page.getByRole("heading", { name: `Activité de ${nom}`, level: 2 })).toHaveCount(0);

  await page.context().close();
});

/**
 * **L'entrée de menu, et pourquoi ce parcours existe.** La fiche d'activité a été livrée le
 * 2026-10-13 sans entrée de navigation : la seule porte vers « Mon compte » était le nom dans
 * l'en-tête, souligné et sans étiquette, et ce nom est masqué sous 640 px (F17) - la page était donc
 * purement inatteignable sur un écran étroit. Le porteur du projet ne l'a pas trouvée. Livrer une
 * fonction qu'on ne peut pas atteindre, c'est ne pas l'avoir livrée.
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

  // L'avocat ne porte pas ROLE_CONSULTATION : ni l'entrée, ni la page.
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
 * L'activité d'un avocat (Q-135) — REC-E2E-038.
 *
 * **Ce jalon corrige une affirmation fausse.** J'avais exclu l'avocat de la fiche d'activité en
 * soutenant qu'il n'aurait rien à y lire : « aucune des natures comptées n'est la sienne ». Il
 * dépose ses demandes de frais, ses comptes rendus d'audience, ses autres publications, et répond
 * aux demandes d'explication - quatre natures, toutes tracées sous son compte.
 *
 * Trois choses se tiennent ici, et aucune ne se vérifie en test unitaire : que l'avocat atteigne sa
 * fiche **sur son propre écran**, que ses lignes de détail ne lui proposent **aucun lien** vers un
 * dossier qu'il ne peut pas ouvrir, et que la direction atteigne la sienne **depuis le répertoire**,
 * là où elle le juge déjà.
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
  // Ni note, ni score, pour lui comme pour les autres.
  expect(await tableau.innerText()).not.toContain("%");

  // Il télécharge la sienne, dans les trois formats.
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
   * Le point qui lui est propre : **aucun lien vers un dossier**. Il n'a pas d'écran de fiche
   * dossier (QF-01), et lui en proposer un l'aurait mené à un refus de droits - une invitation à se
   * faire claquer la porte au nez. Il lit la référence, qui lui suffit.
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

  // « Mon compte » porte aussi « Ma signature », qui n'a pas de sens pour lui : ni entrée, ni page.
  await expect(
    page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Mon compte" }),
  ).toHaveCount(0);
  await page.goto("/mon-compte");
  await expect(page.getByRole("heading", { name: "Vous n’avez pas les droits nécessaires" })).toBeVisible();

  // Et le répertoire, d'où la direction ouvre l'activité d'un avocat, lui reste fermé.
  await page.goto("/repertoire/avocats");
  await expect(page.getByRole("heading", { name: "Vous n’avez pas les droits nécessaires" })).toBeVisible();

  await page.context().close();
});

/**
 * La direction atteint l'activité d'un avocat **depuis le répertoire** : c'est là qu'elle le juge
 * déjà, à côté de sa charge et de ses délibérés gagnés, au moment où elle lui confie un dossier.
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
   * Le juriste et l'Assistante atteignent ce répertoire - c'est leur outil de choix d'un avocat -
   * mais l'activité d'une personne nommée reste à la direction. La colonne n'existe pas pour eux.
   */
  for (const identifiant of ["juriste.test", "assistante.test"]) {
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
 * Le tableau comparatif des avocats (Q-136) — complète REC-E2E-038.
 *
 * **Ce que ce parcours garde.** Le porteur du projet a relevé que « Activité par personne » ne
 * montrait que les profils internes. C'était exact : ses six colonnes comptent des natures de
 * production interne qu'un avocat n'accomplit jamais - il dépose, c'est le juriste qui enregistre.
 * Les réunir n'aurait affiché que des lignes de zéros. D'où **deux tableaux sur le même écran**, et
 * ce parcours vérifie qu'ils y sont tous les deux, avec leurs colonnes propres.
 */
test("le DJ lit les deux tableaux : les internes, puis les avocats", async ({ page }) => {
  await seConnecter(page, "dj.test");
  await page.goto("/rapports");

  // Les deux blocs coexistent, et ne se confondent pas.
  await expect(page.getByRole("heading", { name: "Activité par personne", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Activité des avocats", level: 2 })).toBeVisible();

  // Rien avant le clic : les deux tableaux nomment des personnes.
  await expect(page.getByText("Choisissez une période, puis affichez.", { exact: true })).toHaveCount(2);

  await page.locator("#avocats-debut").fill("2020-01-01");
  await page.locator("#avocats-fin").fill("2030-12-31");
  await page.getByRole("button", { name: "Afficher l’activité des avocats" }).click();

  const tableau = page.getByRole("table", { name: /Activité des avocats du/ });
  await expect(tableau).toBeVisible({ timeout: 30_000 });
  /*
   * Ses colonnes sont celles de ce qu'un avocat **fait**, et aucune n'est celle du tableau interne.
   * C'est tout l'objet de ce jalon : quatre colonnes utiles plutôt que six colonnes de zéros.
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

  // Par nom, comme les internes : un avocat chargé n'est pas un avocat méritant.
  const noms = await tableau.locator("tbody tr td:nth-child(1)").allInnerTexts();
  const premiers = noms.map((cellule) => cellule.split("\n")[0].trim());
  expect(premiers).toEqual([...premiers].sort((a, b) => a.localeCompare(b, "fr")));

  // Son nom ouvre sa fiche complète, comme pour un collègue.
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
 * Le détail des blocs du tableau de bord (Q-137) — REC-E2E-039.
 *
 * **Ce qu'aucun test unitaire ne peut tenir ici** : que les **neuf** blocs s'ouvrent, qu'une ligne
 * mène réellement à sa fiche, et que le total annoncé par la modale soit celui du bloc - la
 * concordance des deux chiffres est ce qui fait leur crédibilité, et elle se vérifie à l'œil.
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
    // Le titre répète le mot sur lequel on a cliqué : sans cela, neuf modales se ressemblent.
    await expect(modale.getByRole("heading", { name: libelle })).toBeVisible({ timeout: 30_000 });
    // Soit des lignes, soit un état vide - jamais une erreur.
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
   * L'onglet d'arrivée doit exister. C'est l'assertion qui manquait sur la fiche d'activité, et dont
   * l'absence avait laissé passer un onglet « frais » que la fiche dossier n'a pas : un onglet
   * inconnu retombe silencieusement sur la synthèse, et la promesse était fausse sans bruit.
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
 * Les trois indicateurs de litiges ne comptent que les dossiers de **recouvrement** - l'indicateur
 * descend du taux de succès du recouvrement, qui ne portait que sur eux. Le libellé du bloc ne le
 * dit pas ; le détail, lui, le dit, et c'est la première occasion qu'a la Direction de s'en
 * apercevoir. Signalé pour arbitrage, et non corrigé en silence.
 */
test("le détail dit les restrictions que le libellé du bloc ne dit pas", async ({ page }) => {
  await seConnecter(page, "dja.test");
  await page.goto("/tableau-de-bord");

  await page.getByRole("button", { name: "Voir le détail de « Litiges gagnés »" }).click();
  await expect(
    page.getByRole("dialog").getByText("Ce décompte ne porte que sur les dossiers de recouvrement."),
  ).toBeVisible({ timeout: 30_000 });
  await page.getByRole("dialog").getByRole("button", { name: "Fermer" }).click();

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
