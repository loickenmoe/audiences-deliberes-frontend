import { loadEnvConfig } from "@next/env";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Alertes, notifications et paramètres système (écrans 03 et 41) **contre le backend réel**.
 *
 * Le canal temps réel est vérifié dans les deux sens : ouvert, une alerte déclenchée par l'API
 * apparaît sans rechargement ; coupé, la même alerte finit par apparaître par le repli HTTP. C'est
 * le cœur de QF-11 — le push est un accélérateur, jamais la source de vérité.
 */

loadEnvConfig(process.cwd());

const MOT_DE_PASSE = "Password1!";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

async function jeton(identifiant: string): Promise<string> {
  const reponse = await fetch(`${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: process.env.KEYCLOAK_CLIENT_ID ?? "",
      client_secret: process.env.KEYCLOAK_CLIENT_SECRET ?? "",
      username: identifiant,
      password: MOT_DE_PASSE,
      scope: "openid",
    }),
  });
  if (!reponse.ok) throw new Error(`Connexion refusée pour ${identifiant} (${reponse.status})`);
  return ((await reponse.json()) as { access_token: string }).access_token;
}

async function appel(chemin: string, jetonAcces: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${chemin}`, {
    ...init,
    headers: { Authorization: `Bearer ${jetonAcces}`, "Content-Type": "application/json", ...init.headers },
  });
}

async function json<T>(chemin: string, jetonAcces: string, init: RequestInit = {}): Promise<T> {
  const reponse = await appel(chemin, jetonAcces, init);
  if (!reponse.ok) {
    throw new Error(`${init.method ?? "GET"} ${chemin} → ${reponse.status} ${await reponse.text()}`);
  }
  return (await reponse.json()) as T;
}

function suffixe() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

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

/** L'avocat du référentiel rattaché au compte `avocat.test`, par son identifiant de connexion (Q-84). */
async function avocatDuCompteTest(): Promise<number> {
  const juriste = await jeton("juriste.test");
  const trouver = async () =>
    (
      await json<{ content: { id: number; compteKeycloak: string | null }[] }>(
        "/intervenants?type=AVOCAT&size=200",
        juriste,
      )
    ).content.find((a) => a.compteKeycloak === "avocat.test");
  const existant = await trouver();
  if (existant) return existant.id;
  const creation = await appel("/intervenants", await jeton("dj.test"), {
    method: "POST",
    body: JSON.stringify({ type: "AVOCAT", nom: "Me Claire Avocat", compteKeycloak: "avocat.test" }),
  });
  if (creation.ok) return ((await creation.json()) as { id: number }).id;
  const cree = await trouver();
  if (cree) return cree.id;
  throw new Error(`POST /intervenants → ${creation.status}`);
}

/**
 * Déclenche une alerte pour **l'Assistante** : le dépôt d'une demande de frais notifie le profil
 * ASSISTANTE (RG-INT-01). Le texte du déclencheur porte la référence du dossier, ce qui donne au
 * test une ligne identifiable parmi les notifications déjà présentes.
 */
async function deposerDemandeDeFrais(): Promise<string> {
  const juriste = await jeton("juriste.test");
  const avocatId = await avocatDuCompteTest();
  const juristes = await json<{ id: number }[]>("/utilisateurs?profil=JURISTE", juriste);
  const clients = await json<{ content: { id: number }[] }>("/clients?size=1", juriste);
  const reference = `DOS-ALR-${suffixe()}`;
  const dossier = await json<{ id: number }>("/dossiers", juriste, {
    method: "POST",
    body: JSON.stringify({
      reference,
      nature: "Assignation en paiement",
      juridictionSaisie: "TGI Douala",
      clientId: clients.content[0]!.id,
      risqueEncouru: 5_000_000,
      dossierCreditOrigine: "CRD-ALR",
      pvTransfert: "PV-ALR",
      juristesAffectes: [juristes[0]!.id],
      avocatsAffectes: [avocatId],
    }),
  });
  await json<{ id: number }>("/frais/demandes", await jeton("avocat.test"), {
    method: "POST",
    body: JSON.stringify({
      dossierId: dossier.id,
      montant: 1_200_000,
      piecesJustificatives: ["facture.pdf"],
      referenceFacture: `FAC-${suffixe()}`,
    }),
  });
  return reference;
}

test("une alerte déclenchée sur le backend apparaît sans rechargement, et se marque traitée", async ({
  browser,
}) => {
  const page = await pageConnectee(browser, "assistante.test");
  await page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("link", { name: "Notifications" })
    .click();
  await page.waitForURL(/\/notifications/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Mes notifications", level: 1 })).toBeVisible();

  // Le canal STOMP doit être établi avant de déclencher : sinon le test mesurerait le repli.
  await expect(page.getByText("Temps réel actif")).toBeVisible({ timeout: 60_000 });

  const reference = await deposerDemandeDeFrais();

  /*
   * Aucun `reload()` : la ligne arrive d'elle-même. La fenêtre dépasse volontairement la période du
   * repli (30 s) — ce que le jalon garantit, c'est « poussée temps réel **ou** repli », pas que la
   * poussée gagne à tous les coups. Avec exactement 30 s, une poussée perdue faisait échouer le test
   * à l'instant précis où le repli allait jouer : c'était le test qui mentait, pas l'application.
   */
  const ligne = page.getByRole("row", { name: new RegExp(reference) });
  await expect(ligne).toBeVisible({ timeout: 75_000 });
  await expect(ligne).toContainText("Nouvelle demande de frais");
  await expect(page.getByTestId("compteur-notifications")).toBeVisible();

  // #46 — le destinataire la marque traitée ; elle quitte la vue « Non lues ».
  await ligne.getByRole("button", { name: "Marquer traitée" }).click();
  await expect(page.getByText("Notification marquée comme traitée.")).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(reference) })).toHaveCount(0);

  await page.getByRole("button", { name: "Traitées", exact: true }).click();
  await expect(page.getByRole("row", { name: new RegExp(reference) })).toBeVisible();

  await page.context().close();
});

test("canal coupé, la notification arrive quand même par le repli HTTP", async ({ browser }) => {
  const contexte = await browser.newContext({ locale: "fr-FR" });
  const page = await contexte.newPage();
  // Le canal est coupé au niveau du réseau : ni négociation SockJS, ni transport.
  await page.route("**/ws/**", (route) => route.abort());
  await seConnecter(page, "assistante.test");
  await page.goto("/notifications");

  await expect(page.getByText("Temps réel interrompu")).toBeVisible({ timeout: 60_000 });

  const reference = await deposerDemandeDeFrais();

  // Cadence de repli : 30 s. La marge couvre le déclenchement et un cycle manqué.
  await expect(page.getByRole("row", { name: new RegExp(reference) })).toBeVisible({ timeout: 90_000 });

  await contexte.close();
});

test("seul le destinataire peut marquer une notification traitée (#46)", async () => {
  await deposerDemandeDeFrais();
  const assistante = await jeton("assistante.test");
  const notifications = await json<{ content: { id: number }[] }>(
    "/alertes/mes-notifications?statut=DECLENCHEE&size=1",
    assistante,
  );
  const alerteId = notifications.content[0]?.id;
  expect(alerteId, "l'Assistante doit avoir au moins une notification non lue").toBeDefined();

  const intrus = await appel(`/alertes/${alerteId}/traiter`, await jeton("juriste.test"), {
    method: "PATCH",
  });
  expect(intrus.status).toBe(403);

  const destinataire = await appel(`/alertes/${alerteId}/traiter`, assistante, { method: "PATCH" });
  expect(destinataire.status).toBe(200);
});

test("le DJ modifie un seuil, qui s'applique immédiatement ; une saisie incohérente est refusée", async ({
  browser,
}) => {
  const dj = await pageConnectee(browser, "dj.test");
  await dj
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("link", { name: "Configuration" })
    .click();
  await dj.waitForURL(/\/admin\/configurations/, { timeout: 60_000 });
  await expect(dj.getByRole("heading", { name: "Paramètres système", level: 1 })).toBeVisible();

  const champ = dj.locator("#configuration-SEUIL_MONTANT_DEFAUT");
  const initiale = (await champ.inputValue()) || "50000000";
  const nouvelle = String(Number(initiale) + 1_000_000);

  // Saisie incohérente : refusée à l'écran, sans appel au backend.
  await champ.fill("50 000 000");
  await expect(dj.getByText("Un nombre entier est attendu, sans espace ni séparateur")).toBeVisible();
  const article = dj.locator("article", { has: dj.locator("#configuration-SEUIL_MONTANT_DEFAUT") });
  await expect(article.getByRole("button", { name: "Enregistrer" })).toBeDisabled();

  // Valeur hors bornes : même refus, sur la règle publiée par le backend.
  await champ.fill("0");
  await expect(article.getByRole("button", { name: "Enregistrer" })).toBeDisabled();

  await champ.fill(nouvelle);
  await article.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dj.getByText("Paramètre SEUIL_MONTANT_DEFAUT enregistré.")).toBeVisible();

  // Prise en compte immédiate : le module frais relit le seuil à chaque réponse (Q-82).
  const demandes = await json<{ content: { seuilApplicable: number }[] }>(
    "/frais/demandes?size=1",
    await jeton("dj.test"),
  );
  if (demandes.content.length > 0) {
    expect(demandes.content[0]!.seuilApplicable).toBe(Number(nouvelle));
  }

  // Remise en état pour les autres parcours.
  await champ.fill(initiale);
  await article.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dj.getByText("Paramètre SEUIL_MONTANT_DEFAUT enregistré.")).toBeVisible();

  await dj.context().close();
});

test("les formats de la GED se choisissent dans la liste publiée ; le juriste ne fait que lire", async ({
  browser,
}) => {
  const dj = await pageConnectee(browser, "dj.test");
  await dj.goto("/admin/configurations");
  const formats = dj.locator("article", { hasText: "FORMATS_GED" });
  // La liste des valeurs vient du backend — l'écran n'en déclare aucune.
  for (const format of ["PDF", "PNG", "JPG", "TXT", "XLSX"]) {
    await expect(formats.getByRole("checkbox", { name: format, exact: true })).toBeVisible();
  }
  await expect(formats.getByRole("checkbox", { name: "PDF", exact: true })).toBeChecked();
  await dj.context().close();

  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto("/admin/configurations");
  await expect(juriste.getByRole("heading", { name: "Paramètres système", level: 1 })).toBeVisible();
  await expect(
    juriste.getByText(
      "Consultation seule - seuls le Directeur Juridique et son Adjoint peuvent modifier ces paramètres.",
    ),
  ).toBeVisible();
  await expect(juriste.getByRole("button", { name: "Enregistrer" })).toHaveCount(0);
  await expect(juriste.locator("#configuration-SEUIL_PROROGATIONS")).toBeDisabled();
  await juriste.context().close();
});

/**
 * Backend Q-108 — la DJA administre les paramètres comme le DJ.
 *
 * Le motif est la **continuité de service** : le DJ absent, plus personne ne pouvait relever un
 * seuil, alors qu'un Adjoint existe pour suppléer. Le parcours vérifie l'écriture de bout en bout —
 * l'écran pouvait auparavant afficher le formulaire à un profil que le backend refusait ensuite.
 */
test("la DJA enregistre un paramètre système comme le DJ (Q-108)", async ({ browser }) => {
  const dja = await pageConnectee(browser, "dja.test");
  await dja.goto("/admin/configurations");
  await expect(dja.getByRole("heading", { name: "Paramètres système", level: 1 })).toBeVisible();
  await expect(dja.getByText(/Consultation seule/)).toHaveCount(0);

  const article = dja.locator("article", { hasText: "SEUIL_PROROGATIONS" });
  const champ = article.locator("#configuration-SEUIL_PROROGATIONS");
  await expect(champ).toBeEnabled();
  const initiale = (await champ.inputValue()).trim();

  await champ.fill("11");
  await article.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dja.getByText("Paramètre SEUIL_PROROGATIONS enregistré.")).toBeVisible();

  // Remise en état : ce seuil pilote les alertes de prorogation des autres parcours.
  await champ.fill(initiale);
  await article.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dja.getByText("Paramètre SEUIL_PROROGATIONS enregistré.")).toBeVisible();
  await dja.context().close();
});

test("le backend refuse une valeur qui casserait un autre module (Q-91)", async () => {
  const dj = await jeton("dj.test");

  const nonNumerique = await appel("/configurations/SEUIL_PROROGATIONS", dj, {
    method: "PUT",
    body: JSON.stringify({ valeur: "beaucoup" }),
  });
  expect(nonNumerique.status).toBe(400);

  const horsBornes = await appel("/configurations/TAILLE_MAX_GED", dj, {
    method: "PUT",
    body: JSON.stringify({ valeur: "104857600" }),
  });
  expect(horsBornes.status).toBe(400);

  const formatInconnu = await appel("/configurations/FORMATS_GED", dj, {
    method: "PUT",
    body: JSON.stringify({ valeur: "PDF,DOCX" }),
  });
  expect(formatInconnu.status).toBe(400);

  // Et la valeur en base n'a pas bougé.
  const configurations = await json<{ cle: string; valeur: string }[]>("/configurations", dj);
  expect(configurations.find((c) => c.cle === "SEUIL_PROROGATIONS")?.valeur).toBe("10");
});

/**
 * Q-109 — le taux de délivrance du canal applicatif, mesuré **en conditions réelles**.
 *
 * Ce parcours vérifie ce qu'aucun test unitaire ne peut établir : que l'issue enregistrée
 * correspond à la présence réelle d'une session STOMP. C'est tout l'enjeu de la mesure —
 * `convertAndSendToUser` réussit même quand personne n'écoute, si bien qu'un indicateur fondé sur
 * l'absence d'exception afficherait 100 % en permanence, panne comprise.
 */
async function statistiques(dateDebut: string, dateFin: string) {
  return json<{
    observees: number;
    diffusees: number;
    differees: number;
    echecs: number;
    tauxDelivrance: number;
    tauxDiffusionTempsReel: number;
    seuilRespecte: boolean;
  }>(`/alertes/statistiques-diffusion?dateDebut=${dateDebut}&dateFin=${dateFin}`, await jeton("dj.test"));
}

/** La fenêtre du jour : l'alerte qu'on va déclencher y tombe forcément. */
function aujourdHui() {
  const jour = new Date().toISOString().slice(0, 10);
  return { debut: jour, fin: jour };
}

test("une alerte poussée à un destinataire connecté est comptée comme diffusée (Q-109)", async ({
  browser,
}) => {
  const { debut, fin } = aujourdHui();
  const page = await pageConnectee(browser, "assistante.test");
  await page.goto("/notifications");
  // Sans cette attente, le test mesurerait une différée et croirait à un défaut.
  await expect(page.getByText("Temps réel actif")).toBeVisible({ timeout: 60_000 });

  const avant = await statistiques(debut, fin);
  const reference = await deposerDemandeDeFrais();
  await expect(page.getByRole("row", { name: new RegExp(reference) })).toBeVisible({ timeout: 75_000 });

  const apres = await statistiques(debut, fin);
  expect(apres.observees).toBeGreaterThan(avant.observees);
  expect(apres.diffusees).toBeGreaterThan(avant.diffusees);
  expect(apres.echecs).toBe(avant.echecs);
  // Le point central : une remise réussie ne fait pas bouger le taux de délivrance, qui ne compte
  // que les échecs.
  expect(apres.seuilRespecte).toBe(true);

  await page.context().close();
});

/**
 * Le pendant du précédent, et le plus important des deux : personne n'est connecté, l'alerte part
 * quand même et **n'est pas comptée comme un échec**. Le canal applicatif comprend la liste des
 * notifications, alimentée inconditionnellement — la remise est plus tardive, pas manquée.
 */
test("une alerte destinée à quelqu'un de déconnecté reste délivrée (Q-109)", async () => {
  const { debut, fin } = aujourdHui();
  const avant = await statistiques(debut, fin);

  // Aucun navigateur ouvert pour l'Assistante : aucune session STOMP ne peut exister.
  await deposerDemandeDeFrais();

  await expect
    .poll(async () => (await statistiques(debut, fin)).differees, { timeout: 30_000 })
    .toBeGreaterThan(avant.differees);

  const apres = await statistiques(debut, fin);
  expect(apres.echecs).toBe(avant.echecs);
  expect(apres.tauxDelivrance).toBe(100);
  expect(apres.seuilRespecte).toBe(true);
});

test("la supervision s'affiche pour le DJ et la DJA, jamais pour un juriste (Q-109)", async ({
  browser,
}) => {
  for (const profil of ["dj.test", "dja.test"]) {
    const page = await pageConnectee(browser, profil);
    await page.goto("/admin/configurations");
    await expect(page.getByRole("heading", { name: "Supervision des alertes", level: 2 })).toBeVisible({
      timeout: 60_000,
    });
    // Les deux taux sont montrés séparément : les réunir viderait la mesure de son sens.
    await expect(page.getByText("Taux de délivrance")).toBeVisible();
    await expect(page.getByText("Diffusion en temps réel")).toBeVisible();
    await expect(page.getByText("Indicateur d’usage, sans seuil opposable")).toBeVisible();
    await page.context().close();
  }

  // Les paramètres restent lisibles par un juriste ; le taux global, non.
  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto("/admin/configurations");
  await expect(juriste.getByRole("heading", { name: "Paramètres système", level: 1 })).toBeVisible();
  await expect(juriste.getByRole("heading", { name: "Supervision des alertes" })).toHaveCount(0);
  await juriste.context().close();
});

test("une fenêtre inversée est expliquée à l'écran, pas renvoyée en erreur technique (Q-109)", async ({
  browser,
}) => {
  const page = await pageConnectee(browser, "dj.test");
  await page.goto("/admin/configurations");
  await expect(page.getByRole("heading", { name: "Supervision des alertes", level: 2 })).toBeVisible({
    timeout: 60_000,
  });

  await page.locator("#supervision-debut").fill("2026-12-31");
  // Le message est cherché **dans la section** : Next pose son propre `role="alert"` à la racine du
  // document pour annoncer les changements de route, et un sélecteur global les confondrait.
  const supervision = page.locator("section", { hasText: "Supervision des alertes" });
  await expect(supervision.getByRole("alert")).toContainText("date de début est postérieure");
  await expect(page.locator("#supervision-debut")).toHaveAttribute("aria-invalid", "true");
  await page.context().close();
});

/**
 * Q-110 — le journal des actions système, contre le backend réel.
 *
 * Le parcours vérifie ce qui fait la valeur de l'écran, et non son habillage : qu'une modification
 * de paramètre y apparaît avec son auteur et ses valeurs, que l'activité des dossiers n'y entre
 * **jamais**, et que la garde de rôle tient.
 */
test("une modification de paramètre apparaît au journal, avec son auteur et ses valeurs (Q-110)", async ({
  browser,
}) => {
  const dj = await pageConnectee(browser, "dj.test");
  await dj.goto("/admin/configurations");
  await expect(dj.getByRole("heading", { name: "Paramètres système", level: 1 })).toBeVisible({
    timeout: 60_000,
  });

  // On produit la trace depuis l'écran lui-même : c'est le geste réel que le journal doit restituer.
  const article = dj.locator("article", { hasText: "SEUIL_PROROGATIONS" });
  const champ = article.locator("#configuration-SEUIL_PROROGATIONS");
  const initiale = (await champ.inputValue()).trim();
  const nouvelle = initiale === "12" ? "13" : "12";
  await champ.fill(nouvelle);
  await article.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dj.getByText("Paramètre SEUIL_PROROGATIONS enregistré.")).toBeVisible();

  const journal = dj.locator("section", { hasText: "Journal des actions système" });
  await expect(journal.getByRole("heading", { name: "Journal des actions système" })).toBeVisible();

  /*
   * La remise en état est dans un `finally` : ce seuil pilote les alertes de prorogation et un autre
   * parcours vérifie qu'il vaut toujours 10. Une première version restaurait après les assertions —
   * l'échec de l'une d'elles laissait donc la valeur modifiée et faisait tomber le parcours suivant,
   * pour une raison qui n'avait rien à voir avec lui. Un test qui échoue ne doit pas en salir un autre.
   */
  try {
    /*
     * Aucun clic pour rafraîchir : le journal vit sur le même écran et doit se mettre à jour seul.
     * La première version ne le faisait pas — on enregistrait un paramètre et le journal juste en
     * dessous l'ignorait, ce dont on aurait conclu que rien n'avait été tracé. Défaut trouvé ici,
     * corrigé par une invalidation ; ce test empêche qu'il revienne.
     */
    const ligne = journal
      .getByRole("row", { name: /Modification de la configuration SEUIL_PROROGATIONS/ })
      .first();
    await expect(ligne).toBeVisible({ timeout: 30_000 });
    // L'ancienne et la nouvelle valeur : c'est ce qui distingue un journal d'une liste d'actes.
    await expect(ligne).toContainText(new RegExp(`nouvelleValeur\\s*${nouvelle}`), { timeout: 30_000 });
    await expect(ligne).toContainText(new RegExp(`ancienneValeur\\s*${initiale}`));
  } finally {
    await champ.fill(initiale);
    await article.getByRole("button", { name: "Enregistrer" }).click();
    await expect(dj.getByText("Paramètre SEUIL_PROROGATIONS enregistré.")).toBeVisible();
    await dj.context().close();
  }
});

/**
 * Le test le plus important du lot. Le journal est une vue d'administration, pas une vue sur les
 * personnes : l'activité des juristes sur leurs dossiers ne doit jamais y entrer. C'est cette
 * limite qui le rend acceptable tant que NF-CONF-01 (RGPD, conservation) reste à définir.
 */
test("le journal ne laisse jamais entrer l'activité des dossiers (Q-110)", async ({ browser }) => {
  // Une action sur un dossier, historisée avec son dossier.
  const reference = await deposerDemandeDeFrais();

  const dja = await pageConnectee(browser, "dja.test");
  await dja.goto("/admin/configurations");
  const journal = dja.locator("section", { hasText: "Journal des actions système" });
  await expect(journal.getByRole("heading", { name: "Journal des actions système" })).toBeVisible({
    timeout: 60_000,
  });

  await expect(journal.getByRole("row", { name: new RegExp(reference) })).toHaveCount(0);
  await expect(journal.getByRole("row", { name: /Création du dossier/ })).toHaveCount(0);
  await expect(journal.getByRole("row", { name: /demande de frais/ })).toHaveCount(0);

  // Et il dit lui-même ce qu'il ne couvre pas, plutôt que de le laisser découvrir.
  await expect(journal.getByText(/Les consultations ne sont pas tracées/)).toBeVisible();
  await dja.context().close();
});

test("le journal est fermé au juriste, à l'Assistante et au SH (Q-110)", async ({ browser }) => {
  for (const profil of ["juriste.test", "assistante.test", "sh.test"]) {
    const page = await pageConnectee(browser, profil);
    await page.goto("/admin/configurations");
    await expect(page.getByRole("heading", { name: "Paramètres système", level: 1 })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByRole("heading", { name: "Journal des actions système" })).toHaveCount(0);
    await page.context().close();
  }
});

test("le journal filtre par auteur et par action, et explique une fenêtre inversée (Q-110)", async ({
  browser,
}) => {
  const dj = await pageConnectee(browser, "dj.test");
  await dj.goto("/admin/configurations");
  const journal = dj.locator("section", { hasText: "Journal des actions système" });
  await expect(journal.getByRole("heading", { name: "Journal des actions système" })).toBeVisible({
    timeout: 60_000,
  });

  // La liste des actions est fermée et vient de la donnée : elle porte au moins un libellé réel.
  const filtreAction = journal.getByLabel("Action", { exact: true });
  await expect(filtreAction.locator("option")).not.toHaveCount(1);

  await journal.getByLabel("Du", { exact: true }).fill("2026-12-31");
  await journal.getByLabel("Au", { exact: true }).fill("2026-01-01");
  await expect(journal.getByRole("alert")).toContainText("date de début est postérieure");

  await journal.getByRole("button", { name: "Réinitialiser" }).click();
  await expect(journal.getByRole("alert")).toHaveCount(0);
  await dj.context().close();
});
