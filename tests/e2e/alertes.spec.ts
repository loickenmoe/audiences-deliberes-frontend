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
      await json<{ id: number; compteKeycloak: string | null }[]>("/intervenants?type=AVOCAT", juriste)
    ).find((a) => a.compteKeycloak === "avocat.test");
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

  // Aucun `reload()` : la ligne arrive par le canal.
  const ligne = page.getByRole("row", { name: new RegExp(reference) });
  await expect(ligne).toBeVisible({ timeout: 30_000 });
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
    juriste.getByText("Consultation seule — seul le Directeur Juridique peut modifier ces paramètres."),
  ).toBeVisible();
  await expect(juriste.getByRole("button", { name: "Enregistrer" })).toHaveCount(0);
  await expect(juriste.locator("#configuration-SEUIL_PROROGATIONS")).toBeDisabled();
  await juriste.context().close();
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
