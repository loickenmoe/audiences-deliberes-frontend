import { loadEnvConfig } from "@next/env";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Alerts, notifications and system settings (screens 03 and 41) against the real backend.
 *
 * The real-time channel is checked both ways: open, an alert triggered through the API appears
 * without reload; cut, the same alert eventually appears through the HTTP fallback. Push is an
 * accelerator, never the source of truth.
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

/** A row of the external notification monitoring (backend D17). */
interface LigneSupervision {
  canal: string;
  enAttente: number;
  remises: number;
  confirmees: number;
  echecs: number;
  sansRetour: number;
  nonJoignables: number;
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

/** The reference-data lawyer linked to the `avocat.test` account. */
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
 * Triggers an alert for the Assistant: filing a fee request notifies the ASSISTANTE profile
 * (RG-INT-01). The trigger text contains the case reference, which identifies the row.
 */
async function deposerDemandeDeFrais(): Promise<string> {
  const juriste = await jeton("juriste.test");
  const avocatId = await avocatDuCompteTest();
  const juristes = await json<{ id: number }[]>("/utilisateurs?profil=JURISTE", juriste);
  const clients = await json<{ content: { id: number }[] }>("/clients?size=1", juriste);
  const dossier = await json<{ id: number; reference: string }>("/dossiers", juriste, {
    method: "POST",
    body: JSON.stringify({
      nature: "Assignation en paiement",
      juridictionSaisie: "TGI Douala",
      clientId: clients.content[0]!.id,
      risqueEncouru: 5_000_000,
      dossierCreditOrigine: "CRD-ALR",
      pvTransfert: "PV-ALR",
      juristesAffectes: [juristes[0]!.id],
      avocatsAffectes: [avocatId],
      // Mandatory.
      parties: { demandeurs: ["AFRILAND FIRST BANK"], defendeurs: ["Débiteur", "Caution"] },
      // Mandatory: 00002 = Bonanjo.
      codeAgenceOrigine: "00002",
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
  // The reference is assigned by the server: read the one it returned.
  return dossier.reference;
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

  // The STOMP channel must be up before triggering, otherwise the test would measure the fallback.
  await expect(page.getByText("Temps réel actif")).toBeVisible({ timeout: 60_000 });

  const reference = await deposerDemandeDeFrais();

  /*
   * No `reload()`: the row arrives by itself. The timeout deliberately exceeds the fallback period
   * (30 s): the guarantee is "real-time push or fallback", not that push always wins.
   */
  const ligne = page.getByRole("row", { name: new RegExp(reference) });
  await expect(ligne).toBeVisible({ timeout: 75_000 });
  await expect(ligne).toContainText("Nouvelle demande de frais");
  await expect(page.getByTestId("compteur-notifications")).toBeVisible();

  // #46: the recipient marks it as handled; it leaves the "Non lues" view.
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
  // Cut the channel at network level: neither SockJS negotiation nor transport.
  await page.route("**/ws/**", (route) => route.abort());
  await seConnecter(page, "assistante.test");
  await page.goto("/notifications");

  await expect(page.getByText("Temps réel interrompu")).toBeVisible({ timeout: 60_000 });

  const reference = await deposerDemandeDeFrais();

  // Fallback period: 30 s. The margin covers the trigger and one missed cycle.
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

  // Inconsistent input: rejected on screen, without a backend call.
  await champ.fill("50 000 000");
  await expect(dj.getByText("Un nombre entier est attendu, sans espace ni séparateur")).toBeVisible();
  const article = dj.locator("article", { has: dj.locator("#configuration-SEUIL_MONTANT_DEFAUT") });
  await expect(article.getByRole("button", { name: "Enregistrer" })).toBeDisabled();

  // Out-of-range value: same rejection, based on the rule published by the backend.
  await champ.fill("0");
  await expect(article.getByRole("button", { name: "Enregistrer" })).toBeDisabled();

  await champ.fill(nouvelle);
  await article.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dj.getByText("Paramètre SEUIL_MONTANT_DEFAUT enregistré.")).toBeVisible();

  // Applied immediately: the fees module rereads the threshold on every response.
  const demandes = await json<{ content: { seuilApplicable: number }[] }>(
    "/frais/demandes?size=1",
    await jeton("dj.test"),
  );
  if (demandes.content.length > 0) {
    expect(demandes.content[0]!.seuilApplicable).toBe(Number(nouvelle));
  }

  // Restore for the other tests.
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
  // The list of values comes from the backend; the screen declares none.
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
 * The DJA administers settings like the DJ, for continuity of service when the DJ is absent.
 * Checks the write end to end.
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

  // Restore: this threshold drives the extension alerts of other tests.
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

  // `ODT` is not a FormatDocument: the rejection is certain and the configuration stays intact.
  const formatInconnu = await appel("/configurations/FORMATS_GED", dj, {
    method: "PUT",
    body: JSON.stringify({ valeur: "PDF,ODT" }),
  });
  expect(formatInconnu.status).toBe(400);

  // The list of formats is unchanged.
  const formats = await json<{ cle: string; valeur: string }[]>("/configurations", dj);
  expect(formats.find((c) => c.cle === "FORMATS_GED")?.valeur).toContain("PNG");

  // And the stored value is unchanged.
  const configurations = await json<{ cle: string; valeur: string }[]>("/configurations", dj);
  expect(configurations.find((c) => c.cle === "SEUIL_PROROGATIONS")?.valeur).toBe("10");
});

/**
 * External notification grid, from screen to database. A fully unchecked column is a valid setting
 * ("nothing by SMS"): the backend must accept it and the screen must read it back empty.
 */
test("le DJ vide une colonne de la grille des notifications, puis la rétablit (Q-118)", async ({ browser }) => {
  const jetonDj = await jeton("dj.test");
  const avant = await json<{ cle: string; valeur: string }[]>("/configurations", jetonDj);
  const initiale = avant.find((c) => c.cle === "GRILLE_NOTIFICATION_SMS")?.valeur ?? "";
  expect(initiale).not.toBe("");

  const dj = await pageConnectee(browser, "dj.test");
  await dj.goto("/admin/configurations");
  await expect(dj.getByRole("heading", { name: "Grille des notifications externes" })).toBeVisible();
  // The grid columns are not repeated in the settings list.
  await expect(dj.locator("article", { hasText: "GRILLE_NOTIFICATION_SMS" })).toHaveCount(0);

  const casesSms = dj.getByRole("checkbox", { name: / par SMS$/ });
  /*
   * Twelve provider events, including expected report (RG-INT-11), received report (RG-INT-06) and
   * explanation request. Guard: an event missing from the grid would be sent on no channel.
   */
  await expect(casesSms).toHaveCount(12);
  for (const caseSms of await casesSms.all()) {
    if (await caseSms.isChecked()) await caseSms.uncheck();
  }
  await dj.getByRole("button", { name: "Enregistrer la grille « Prestataires »" }).click();
  await expect(dj.getByText("Grille des notifications enregistrée.")).toBeVisible();

  const apres = await json<{ cle: string; valeur: string }[]>("/configurations", jetonDj);
  expect(apres.find((c) => c.cle === "GRILLE_NOTIFICATION_SMS")?.valeur).toBe("");
  await dj.reload();
  await expect(dj.getByRole("checkbox", { name: "Rappel d’audience par SMS" })).not.toBeChecked();
  await dj.context().close();

  // Restore: other tests start from the initial grid.
  const retabli = await appel("/configurations/GRILLE_NOTIFICATION_SMS", jetonDj, {
    method: "PUT",
    body: JSON.stringify({ valeur: initiale }),
  });
  expect(retabli.status).toBe(200);
});

/**
 * D17: external notification monitoring on screen 41. It distinguishes what the application
 * handed to the engine from what the engine confirmed: "handed over" is not "received".
 */
test("le DJ supervise les notifications externes ; le juriste n'y a pas accès (D17)", async ({ browser }) => {
  const jetonDj = await jeton("dj.test");
  const aujourdHui = new Date().toISOString().slice(0, 10);
  const debut = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);

  // Read access is restricted to the DJ and the DJA.
  const refus = await appel(`/notifications/supervision?dateDebut=${debut}&dateFin=${aujourdHui}`, await jeton("juriste.test"));
  expect(refus.status).toBe(403);

  const supervision = await json<{ canaux: { canal: string }[]; engineActif: boolean }>(
    `/notifications/supervision?dateDebut=${debut}&dateFin=${aujourdHui}`, jetonDj);
  expect(supervision.canaux.map((c) => c.canal)).toEqual(["EMAIL", "SMS", "WHATSAPP", "TEAMS"]);

  const dj = await pageConnectee(browser, "dj.test");
  await dj.goto("/admin/configurations");
  // Exact match: "Grille des notifications externes" would contain this fragment.
  await expect(dj.getByRole("heading", { name: "Notifications externes", exact: true })).toBeVisible();
  await expect(dj.getByRole("table", { name: "Notifications par canal" })).toBeVisible();
  // The engine is disabled on the server: the screen must say so rather than imply messages are sent.
  if (!supervision.engineActif) {
    await expect(dj.getByText(/Notification Engine est désactivé/)).toBeVisible();
  }
  await dj.context().close();

  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto("/admin/configurations");
  await expect(juriste.getByRole("heading", { name: "Paramètres système", level: 1 })).toBeVisible();
  await expect(juriste.getByRole("heading", { name: "Notifications externes", exact: true })).toHaveCount(0);
  await juriste.context().close();
});

test("le backend refuse le vide là où il n'est pas un réglage (Q-118)", async () => {
  const dj = await jeton("dj.test");
  const formats = await appel("/configurations/FORMATS_GED", dj, {
    method: "PUT",
    body: JSON.stringify({ valeur: "" }),
  });
  expect(formats.status).toBe(400);
});

/**
 * Delivery rate of the in-app channel, measured in real conditions: the recorded outcome must match
 * the actual presence of a STOMP session. `convertAndSendToUser` succeeds even when nobody listens,
 * so an indicator based on the absence of exceptions would always show 100%.
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

/** Today's window: the alert about to be triggered necessarily falls in it. */
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
  // Without this wait, the alert would be deferred and the test would report a false defect.
  await expect(page.getByText("Temps réel actif")).toBeVisible({ timeout: 60_000 });

  const avant = await statistiques(debut, fin);
  const reference = await deposerDemandeDeFrais();
  await expect(page.getByRole("row", { name: new RegExp(reference) })).toBeVisible({ timeout: 75_000 });

  const apres = await statistiques(debut, fin);
  expect(apres.observees).toBeGreaterThan(avant.observees);
  expect(apres.diffusees).toBeGreaterThan(avant.diffusees);
  expect(apres.echecs).toBe(avant.echecs);
  // A successful delivery does not move the delivery rate, which only counts failures.
  expect(apres.seuilRespecte).toBe(true);

  await page.context().close();
});

/**
 * Nobody is connected: the alert is still sent and is not counted as a failure. The in-app channel
 * includes the notification list, which is always fed: delivery is later, not missed.
 */
test("une alerte destinée à quelqu'un de déconnecté reste délivrée (Q-109)", async () => {
  const { debut, fin } = aujourdHui();
  const avant = await statistiques(debut, fin);

  await deposerDemandeDeFrais();

  /*
   * Nothing is lost: the alert is pushed if the recipient listens, deferred otherwise, never failed.
   * Whether it is pushed or deferred depends on parallel workers holding an Assistant session, so
   * only `echecs` is asserted to stay unchanged.
   */
  const delivrees = (etat: { differees: number; diffusees: number }) => etat.differees + etat.diffusees;

  await expect
    .poll(async () => delivrees(await statistiques(debut, fin)), { timeout: 30_000 })
    .toBeGreaterThan(delivrees(avant));

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
    // Both rates are shown separately: merging them would make the measure meaningless.
    await expect(page.getByText("Taux de délivrance")).toBeVisible();
    await expect(page.getByText("Diffusion en temps réel")).toBeVisible();
    await expect(page.getByText("Indicateur d’usage, sans seuil opposable")).toBeVisible();
    await page.context().close();
  }

  // Settings stay readable by a legal officer; the global rate does not.
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
  // Search the message within the section: Next adds its own root `role="alert"` for route
  // announcements, which a global selector would match.
  const supervision = page.locator("section", { hasText: "Supervision des alertes" });
  await expect(supervision.getByRole("alert")).toContainText("date de début est postérieure");
  await expect(page.locator("#supervision-debut")).toHaveAttribute("aria-invalid", "true");
  await page.context().close();
});


/**
 * Step 13, end to end: the DJ configures the grid on screen, a real business action happens, and
 * monitoring reports it. Counters are shared with parallel tests, so only growth is asserted; the
 * exact measure is done backend-side by <code>ChaineNotificationIntegrationTest</code>.
 */
test("le réglage du DJ commande ce qui part, et la supervision le montre (étape 13)", async ({ browser }) => {
  const jetonDj = await jeton("dj.test");
  const fenetre = (() => {
    const fin = new Date().toISOString().slice(0, 10);
    const debut = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    return `dateDebut=${debut}&dateFin=${fin}`;
  })();

  const courriels = async () => {
    const supervision = await json<{ canaux: LigneSupervision[] }>(`/notifications/supervision?${fenetre}`, jetonDj);
    const ligne = supervision.canaux.find((c) => c.canal === "EMAIL");
    expect(ligne, "la supervision expose toujours une ligne par canal").toBeDefined();
    return ligne!.enAttente + ligne!.remises + ligne!.confirmees + ligne!.echecs + ligne!.sansRetour
      + ligne!.nonJoignables;
  };

  const grille = async () =>
    (await json<{ cle: string; valeur: string }[]>("/configurations", jetonDj))
      .find((c) => c.cle === "GRILLE_NOTIFICATION_OUTLOOK")?.valeur ?? "";
  const initiale = await grille();
  expect(initiale).toContain("NOUVELLE_DEMANDE_FRAIS");

  const dj = await pageConnectee(browser, "dj.test");
  await dj.goto("/admin/configurations");
  const caseOutlook = dj.getByRole("checkbox", { name: "Nouvelle demande de frais par Outlook" });
  await expect(caseOutlook).toBeChecked();

  // 1. Unchecked on screen, the event leaves the column in the database and is read back that way.
  await caseOutlook.uncheck();
  await dj.getByRole("button", { name: "Enregistrer la grille « Utilisateurs internes »" }).click();
  await expect(dj.getByText("Grille des notifications enregistrée.")).toBeVisible();
  expect(await grille()).not.toContain("NOUVELLE_DEMANDE_FRAIS");
  await dj.reload();
  await expect(caseOutlook).not.toBeChecked();

  // 2. Checked again, it comes back: full screen-to-database round trip.
  await caseOutlook.check();
  await dj.getByRole("button", { name: "Enregistrer la grille « Utilisateurs internes »" }).click();
  await expect(dj.getByText("Grille des notifications enregistrée.")).toBeVisible();
  expect(await grille()).toContain("NOUVELLE_DEMANDE_FRAIS");

  // 3. A real business action with the setting active: monitoring counts more than before.
  const avant = await courriels();
  await deposerDemandeDeFrais();
  expect(await courriels(), "le dépôt met la notification de l'Assistante en file")
    .toBeGreaterThan(avant);

  // 4. Monitoring reflects the same window, and retry is offered on failures.
  await dj.reload();
  await expect(dj.getByRole("table", { name: "Notifications par canal" })).toBeVisible();
  const defauts = await json<{ derniersEchecs: { id: number; destinataire: string | null }[] }>(
    `/notifications/supervision?${fenetre}`, jetonDj);
  if (defauts.derniersEchecs.length > 0) {
    await expect(dj.getByRole("table", { name: "Envois à examiner" })).toBeVisible();
    await expect(dj.getByRole("button", { name: "Relancer" }).first()).toBeVisible();
  }
  await dj.context().close();

  // 5. Retry is restricted to the DJ and does not resurrect a non-existent send.
  expect((await appel("/notifications/999999999/relancer", await jeton("juriste.test"), { method: "POST" })).status)
    .toBe(403);
  expect((await appel("/notifications/999999999/relancer", jetonDj, { method: "POST" })).status).toBe(404);

  // Restore the initial grid for the other tests.
  const retabli = await appel("/configurations/GRILLE_NOTIFICATION_OUTLOOK", jetonDj, {
    method: "PUT",
    body: JSON.stringify({ valeur: initiale }),
  });
  expect(retabli.status).toBe(200);
});
