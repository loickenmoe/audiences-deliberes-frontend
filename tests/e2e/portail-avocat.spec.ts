import { loadEnvConfig } from "@next/env";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { ligneDansLaFile } from "./files-de-travail";

/**
 * Lawyer portal (screens 30 and 33) against the real backend. The key concern is isolation: an
 * external lawyer must only see their own cases and nothing of the bank's portfolio. Two journeys
 * check it, one of them calling the API directly with the lawyer's token.
 */

loadEnvConfig(process.cwd());

const MOT_DE_PASSE = "Password1!";

const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
);
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

async function json<T>(chemin: string, jetonAcces: string): Promise<T> {
  const reponse = await appel(chemin, jetonAcces);
  if (!reponse.ok) throw new Error(`GET ${chemin} → ${reponse.status} ${await reponse.text()}`);
  return (await reponse.json()) as T;
}

/** An invoice name as a law firm would produce it: the length used to break the row. */
const NOM_LONG = "facture-honoraires-cabinet-fotso-et-associes-septembre-2026.pdf";

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

/**
 * Creates a case assigned to the test lawyer through the API and returns its reference. Goes
 * through the legal officer, the only one allowed to create and assign.
 */
async function creerDossierAffecteALAvocat(): Promise<string> {
  const juriste = await jeton("juriste.test");
  const dj = await jeton("dj.test");

  const avocats = await json<{ content: { id: number; compteKeycloak: string | null }[] }>(
    "/intervenants?type=AVOCAT&size=200",
    juriste,
  );
  let fiche = avocats.content.find((a) => a.compteKeycloak === "avocat.test");
  if (!fiche) {
    const creation = await appel("/intervenants", dj, {
      method: "POST",
      body: JSON.stringify({ type: "AVOCAT", nom: "Me Claire Avocat", compteKeycloak: "avocat.test" }),
    });
    fiche = (await creation.json()) as { id: number; compteKeycloak: string | null };
  }

  const juristes = await json<{ id: number }[]>("/utilisateurs?profil=JURISTE", juriste);
  const clients = await json<{ content: { id: number }[] }>("/clients?size=1", juriste);
  const creation = await appel("/dossiers", juriste, {
    method: "POST",
    body: JSON.stringify({
      nature: "Assignation en paiement",
      juridictionSaisie: "TGI Douala",
      clientId: clients.content[0]!.id,
      risqueEncouru: 3_000_000,
      dossierCreditOrigine: "CRD-RECH",
      pvTransfert: "PV-RECH",
      juristesAffectes: [juristes[0]!.id],
      avocatsAffectes: [fiche!.id],
      // At least one party on each side is required.
      parties: { demandeurs: ["AFRILAND FIRST BANK"], defendeurs: ["Débiteur", "Caution"] },
      // Required: the branch comes from the reference data (00002 = Bonanjo).
      codeAgenceOrigine: "00002",
    }),
  });
  expect(creation.status, "le dossier de recherche doit être créé").toBe(201);
  // The reference is server-assigned: read it from the response.
  const cree = (await creation.json()) as { reference: string };
  return cree.reference;
}

async function choisirDossier(page: Page, id: string, reference?: string) {
  const champ = page.getByRole("combobox", { name: "Dossier" });
  await champ.click();
  if (reference) await champ.fill(reference);
  const liste = page.getByRole("listbox", { name: "Dossier" });
  const option = reference
    ? liste.getByRole("option", { name: new RegExp(reference) }).first()
    : liste.getByRole("option").first();
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  await champ.press("Escape");
  void id;
}

test("l'avocat ne voit que ses dossiers, et rien du portefeuille de la banque (Q-96)", async () => {
  const avocat = await jeton("avocat.test");

  const mesDossiers = await json<{ content: { id: number; reference: string }[]; totalElements: number }>(
    "/avocat/mes-dossiers?size=100",
    avocat,
  );
  const tousLesDossiers = await json<{ totalElements: number }>("/dossiers?size=1", await jeton("juriste.test"));

  /*
   * The lawyer never sees more than exists. A strict inequality would depend on the dataset (on a
   * fresh database `avocat.test` may own every case); isolation is proven by the response shape and
   * the 403s below.
   */
  expect(mesDossiers.totalElements).toBeLessThanOrEqual(tousLesDossiers.totalElements);

  // The response is limited to identification: no portfolio field may leak.
  const premier = mesDossiers.content[0];
  expect(premier, "l'avocat de test doit être affecté à au moins un dossier").toBeDefined();
  expect(Object.keys(premier!).sort()).toEqual(["id", "juridictionSaisie", "nature", "reference"]);

  // Internal endpoints stay closed to the lawyer.
  for (const chemin of ["/dossiers", "/publications", "/clients", "/utilisateurs"]) {
    expect((await appel(chemin, avocat)).status, `${chemin} doit rester fermé à l'avocat`).toBe(403);
  }

  // The portal stays closed to internal profiles, which have their own screens.
  expect((await appel("/avocat/mes-dossiers", await jeton("juriste.test"))).status).toBe(403);
});

test("l'avocat dépose une demande de frais en choisissant son dossier (écran 30)", async ({ browser }) => {
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("link", { name: "Déposer une demande" })
    .click();
  await avocat.waitForURL(/\/frais\/nouvelle/, { timeout: 60_000 });

  const reference = `FAC-E2E-${suffixe()}`;
  // The selector is fed by `GET /avocat/mes-dossiers`.
  await choisirDossier(avocat, "frais-dossier");
  await avocat.locator("#frais-reference").fill(reference);
  await avocat.locator("#frais-montant").fill("450000");
  // UC-INT-01 step 4: the document is a real file, uploaded as soon as it is chosen.
  await avocat
    .locator('input[name="piece-justificative"]')
    .setInputFiles({ name: "facture.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(avocat.getByText("facture.pdf")).toBeVisible({ timeout: 30_000 });

  /*
   * Review the document before sending: once filed, replacing it requires a new request. The
   * preview opens without leaving the form.
   */
  await avocat.getByRole("button", { name: "Consulter - facture.pdf" }).click();
  const apercuAvocat = avocat.getByRole("dialog", { name: "Aperçu - facture.pdf" });
  await expect(apercuAvocat).toBeVisible({ timeout: 30_000 });
  // Two buttons close the window (the cross and the footer button): take the first.
  await apercuAvocat.getByRole("button", { name: "Fermer" }).first().click();

  await avocat.getByRole("button", { name: "Déposer", exact: true }).click();

  await expect(avocat.getByText("Demande de frais déposée.")).toBeVisible({ timeout: 30_000 });
  await avocat.waitForURL(/\/frais$/, { timeout: 60_000 });
  // Their queue (#28) only shows their own requests.
  await expect(avocat.getByRole("row", { name: new RegExp(reference) })).toBeVisible({ timeout: 30_000 });

  await avocat.context().close();
});

test("une référence de facture en doublon est signalée sur le champ concerné", async ({ browser }) => {
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/frais/nouvelle");

  const reference = `FAC-DUP-${suffixe()}`;
  for (const tentative of [1, 2]) {
    await choisirDossier(avocat, "frais-dossier");
    await avocat.locator("#frais-reference").fill(reference);
    await avocat.locator("#frais-montant").fill("100000");
    await avocat
      .locator('input[name="piece-justificative"]')
      .setInputFiles({ name: "facture.pdf", mimeType: "application/pdf", buffer: PDF });
    await expect(avocat.getByText("facture.pdf")).toBeVisible({ timeout: 30_000 });
    await avocat.getByRole("button", { name: "Déposer", exact: true }).click();
    if (tentative === 1) {
      await expect(avocat.getByText("Demande de frais déposée.")).toBeVisible({ timeout: 30_000 });
      await avocat.goto("/frais/nouvelle");
    }
  }

  // The backend names the faulty field: the message sits on it, not in a banner.
  await expect(avocat.locator("#frais-reference")).toHaveAttribute("aria-invalid", "true", { timeout: 30_000 });

  await avocat.context().close();
});

test("l'avocat dépose un compte rendu rattaché à une audience de son dossier (écran 33)", async ({
  browser,
}) => {
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/publications/nouvelle");
  await expect(avocat.getByRole("heading", { name: "Déposer une publication", level: 1 })).toBeVisible();

  // Both filing types are described side by side, not hidden behind tabs.
  // `exact`: the screen's intro sentence repeats both expressions.
  await expect(avocat.getByText("Compte rendu d’audience", { exact: true })).toBeVisible();
  await expect(avocat.getByText("Document du dossier", { exact: true })).toBeVisible();

  // Until a case is chosen, the hearing cannot be: it belongs to the case.
  await expect(avocat.locator("#publication-audience")).toBeDisabled();

  await choisirDossier(avocat, "publication-dossier");
  const audiences = avocat.locator("#publication-audience");
  await expect(audiences).toBeEnabled({ timeout: 30_000 });

  const marque = `Renvoi constaté ${suffixe()}`;
  if ((await audiences.locator("option").count()) > 1) {
    await audiences.selectOption({ index: 1 });
    await avocat.locator("#publication-contenu").fill(marque);
    // The document is optional: this filing has none and must succeed.
    await avocat.getByRole("button", { name: "Déposer le compte rendu" }).click();
    await expect(avocat.getByText("Compte rendu déposé. Il est immédiatement consultable par la Direction Juridique ; l’Assistante en accusera réception.")).toBeVisible({
      timeout: 30_000,
    });
    await avocat.waitForURL(/\/portail/, { timeout: 60_000 });
    await expect(avocat.getByRole("heading", { name: "Mon espace", level: 1 })).toBeVisible();
  } else {
    // No scheduled hearing: the screen explains it instead of showing an empty selector.
    await expect(avocat.getByText("Aucune audience n’est encore planifiée sur ce dossier.")).toBeVisible();
  }

  await avocat.context().close();
});

/**
 * The report and its document are filed in a single upload, attached to the same hearing. The
 * reading side (the Assistant opening the document from the publication) is checked by P2 in
 * `parcours-metier.spec.ts`, on a dedicated case.
 */
test("un compte rendu part avec sa pièce, en un seul dépôt", async ({ browser }) => {
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/publications/nouvelle");
  await choisirDossier(avocat, "publication-dossier");
  const audiences = avocat.locator("#publication-audience");
  await expect(audiences).toBeEnabled({ timeout: 30_000 });

  if ((await audiences.locator("option").count()) <= 1) return; // case without a hearing: nothing to attach

  const marque = suffixe();
  await audiences.selectOption({ index: 1 });
  await avocat.locator("#publication-contenu").fill(`Renvoi avec plumitif ${marque}`);
  await avocat
    .locator('input[name="piece-jointe"]')
    .setInputFiles({ name: `plumitif-${marque}.pdf`, mimeType: "application/pdf", buffer: PDF });

  /*
   * The lawyer reviews the document before filing the report: a filed publication cannot be
   * corrected, only filed again.
   */
  await avocat.getByRole("button", { name: `Consulter - plumitif-${marque}.pdf` }).click();
  const apercuPiece = avocat.getByRole("dialog", { name: `Aperçu - plumitif-${marque}.pdf` });
  await expect(apercuPiece).toBeVisible({ timeout: 30_000 });
  await apercuPiece.getByRole("button", { name: "Fermer" }).first().click();

  await avocat.getByRole("button", { name: "Déposer le compte rendu" }).click();
  await expect(avocat.getByText("Compte rendu déposé. Il est immédiatement consultable par la Direction Juridique ; l’Assistante en accusera réception.")).toBeVisible({
    timeout: 30_000,
  });

  // The filing appears in their space, where they can review what they sent.
  await avocat.goto("/portail");
  await expect(avocat.getByRole("heading", { name: "Mon espace", level: 1 })).toBeVisible({ timeout: 30_000 });
  await avocat.context().close();
});

test("l'avocat relit ses dépôts et ses constitutions dans son espace", async ({ browser }) => {
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("link", { name: "Mon espace" })
    .click();
  await avocat.waitForURL(/\/portail/, { timeout: 60_000 });

  await expect(avocat.getByRole("heading", { name: "Mon espace", level: 1 })).toBeVisible();
  await expect(avocat.getByRole("heading", { name: "Mes dépôts", level: 2 })).toBeVisible();
  await expect(avocat.getByRole("heading", { name: "Mes lettres de constitution", level: 2 })).toBeVisible();

  await avocat.context().close();
});

/**
 * The case selector searches the server: a lawyer following many cases must still find older ones.
 * The journey creates a case, pushes it down with newer ones, then checks the lawyer finds it by
 * searching.
 */
test("l'avocat retrouve par la recherche un dossier repoussé hors de la première page", async ({ browser }) => {
  const reference = await creerDossierAffecteALAvocat();

  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/frais/nouvelle");
  await expect(avocat.getByRole("heading", { name: "Déposer une demande de frais", level: 1 })).toBeVisible();

  const champ = avocat.getByRole("combobox", { name: "Dossier" });
  await champ.click();
  await champ.fill(reference);
  const liste = avocat.getByRole("listbox", { name: "Dossier" });
  await expect(liste.getByRole("option", { name: new RegExp(reference) })).toBeVisible({ timeout: 30_000 });

  // Search is case-insensitive.
  await champ.fill(reference.toLowerCase());
  await expect(liste.getByRole("option", { name: new RegExp(reference) })).toBeVisible({ timeout: 30_000 });

  await avocat.context().close();
});

/**
 * The document uploaded by the lawyer must be openable by the Assistant (not just a storage path),
 * so compliance can be judged. The journey follows it end to end: lawyer uploads, Assistant opens.
 */
test("la pièce déposée par l'avocat s'ouvre chez l'Assistante", async ({ browser }) => {
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/frais/nouvelle");
  const reference = `FAC-PJ-${suffixe()}`;
  await choisirDossier(avocat, "frais-dossier");
  await avocat.locator("#frais-reference").fill(reference);
  await avocat.locator("#frais-montant").fill("320000");
  await avocat
    .locator('input[name="piece-justificative"]')
    .setInputFiles({ name: "releve-diligences.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(avocat.getByText("releve-diligences.pdf")).toBeVisible({ timeout: 30_000 });
  await avocat.getByRole("button", { name: "Déposer", exact: true }).click();
  await expect(avocat.getByText("Demande de frais déposée.")).toBeVisible({ timeout: 30_000 });
  await avocat.context().close();

  const assistante = await pageConnectee(browser, "assistante.test");
  await assistante.goto("/frais");
  await assistante.getByRole("link", { name: reference }).click();
  await assistante.waitForURL(/\/frais\/\d+/, { timeout: 60_000 });

  // The original name, not the storage path: what a human can read.
  await expect(assistante.getByText("releve-diligences.pdf")).toBeVisible({ timeout: 30_000 });
  await expect(assistante.getByText(/^frais\//)).toHaveCount(0);

  await assistante.getByRole("button", { name: "Consulter - releve-diligences.pdf" }).click();
  const apercu = assistante.getByRole("dialog", { name: "Aperçu - releve-diligences.pdf" });
  await expect(apercu).toBeVisible({ timeout: 30_000 });
  await apercu.getByRole("button", { name: "Fermer" }).first().click();

  const telechargement = assistante.waitForEvent("download");
  await assistante.getByRole("button", { name: "Télécharger - releve-diligences.pdf" }).click();
  expect((await telechargement).suggestedFilename()).toBe("releve-diligences.pdf");
  await assistante.context().close();
});

/**
 * Once the publication is acknowledged, the lawyer's report is reachable from the hearing (it lives
 * in publications, attached to the hearing). The journey: lawyer files, Assistant acknowledges, the
 * hearing row links to it.
 */
test("le compte rendu validé de l'avocat se retrouve depuis son audience", async ({ browser }) => {
  const juriste = await pageConnectee(browser, "juriste.test");
  const marque = suffixe();

  // A new case with a hearing today: the report must be attachable to it.
  const reference = await creerDossierAffecteALAvocat();
  await juriste.goto("/dossiers");
  await juriste.getByLabel("Référence", { exact: true }).fill(reference);
  await juriste.getByRole("link", { name: reference }).click();
  await juriste.waitForURL(/\/dossiers\/\d+/, { timeout: 60_000 });
  const url = juriste.url();

  await juriste.getByRole("tab", { name: "Étapes" }).click();
  await juriste.getByLabel("Faire passer à", { exact: true }).selectOption("EN_COURS");
  await juriste.getByRole("button", { name: "Appliquer" }).click();

  await juriste.getByRole("tab", { name: "Audiences" }).click();
  await juriste.getByRole("button", { name: "Planifier une audience" }).click();
  const aujourdHui = new Date();
  const jour = `${aujourdHui.getFullYear()}-${String(aujourdHui.getMonth() + 1).padStart(2, "0")}-${String(aujourdHui.getDate()).padStart(2, "0")}`;
  await juriste.getByLabel("Date de l’audience", { exact: true }).fill(jour);
  await juriste
    .getByRole("dialog", { name: "Planifier une audience" })
    .getByRole("button", { name: "Enregistrer" })
    .click();
  await expect(juriste.getByRole("cell", { name: "Planifiée", exact: true })).toHaveCount(1);
  await juriste.context().close();

  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/publications/nouvelle");
  await choisirDossier(avocat, "publication-dossier", reference);
  const audiences = avocat.locator("#publication-audience");
  await expect(audiences).toBeEnabled({ timeout: 30_000 });
  await audiences.selectOption({ index: 1 });
  await avocat.locator("#publication-contenu").fill(`Renvoi contradictoire ${marque}`);
  await avocat.getByRole("button", { name: "Déposer le compte rendu" }).click();
  await expect(avocat.getByText("Compte rendu déposé. Il est immédiatement consultable par la Direction Juridique ; l’Assistante en accusera réception.")).toBeVisible({
    timeout: 30_000,
  });
  await avocat.context().close();

  const assistante = await pageConnectee(browser, "assistante.test");
  await assistante.goto("/publications");
  /*
   * The queue is FIFO and paginated: the report just filed is last, so not necessarily on the first
   * page.
   */
  const ligneFile = await ligneDansLaFile(assistante, new RegExp(reference));
  await ligneFile.getByRole("link").first().click();
  await assistante.waitForURL(/\/publications\/\d+/, { timeout: 60_000 });
  /*
   * A report is not validated: the Assistant acknowledges receipt. Assigned legal officers can read
   * it as soon as it is filed; acknowledgement opens it to others and tells the lawyer it was
   * received. There is no reject button: a hearing report is contested through correspondence.
   */
  await assistante.getByRole("button", { name: "Accuser réception" }).click();
  await assistante
    .getByRole("dialog", { name: "Accuser réception du compte rendu ?" })
    .getByRole("button", { name: "Accuser réception" })
    .click();
  // Wait for the confirmation, not just the click: navigating too early left the publication
  // "déposée", and the hearing then had no report.
  await expect(assistante.getByText("Réception du compte rendu accusée.")).toBeVisible({
    timeout: 30_000,
  });

  // From the hearing, the row links to the lawyer's report.
  await assistante.goto(`${url}?onglet=audiences`);
  const lien = assistante.getByRole("link", { name: "Compte rendu de l’avocat" });
  await expect(lien).toBeVisible({ timeout: 30_000 });
  await lien.click();
  await expect(assistante.getByText(`Renvoi contradictoire ${marque}`)).toBeVisible({ timeout: 30_000 });
  await assistante.context().close();
});

test("le portail reste invisible aux profils internes", async ({ browser }) => {
  const juriste = await pageConnectee(browser, "juriste.test");
  const navigation = juriste.getByRole("navigation", { name: "Navigation principale" });

  for (const entree of ["Mon espace", "Déposer une demande", "Déposer une publication"]) {
    await expect(navigation.getByRole("link", { name: entree })).toHaveCount(0);
  }

  await juriste.goto("/portail");
  await expect(juriste.getByRole("heading", { name: "Vous n’avez pas les droits nécessaires" })).toBeVisible();

  await juriste.context().close();
});

test("les écrans du portail sont traduits", async ({ browser }) => {
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/frais/nouvelle");
  await expect(avocat.getByRole("heading", { name: "Déposer une demande de frais", level: 1 })).toBeVisible();

  await avocat.getByRole("button", { name: "en", exact: true }).click();
  await expect(avocat.getByRole("heading", { name: "File a fee claim", level: 1 })).toBeVisible({
    timeout: 30_000,
  });
  await expect(avocat.getByRole("button", { name: "Submit" })).toBeVisible();

  await avocat.context().close();
});

/**
 * A lawyer whose account is not yet registered in the directory. Only runs if the reference data
 * does not know `avocat.test` (forcing it would delete a record other journeys depend on). The state
 * must be explained, not shown as a failure, on the four screens the lawyer can reach.
 */
test("un compte non rattaché au répertoire est expliqué, pas présenté comme un échec", async ({
  browser,
}) => {
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/portail");

  const explication = avocat.getByText("pas encore rattaché au répertoire");
  if ((await explication.count()) === 0) {
    await avocat.context().close();
    return; // the account is registered: not the targeted case
  }

  for (const chemin of ["/portail", "/frais", "/frais/nouvelle", "/publications/nouvelle"]) {
    await avocat.goto(chemin);
    await expect(
      avocat.getByText("pas encore rattaché au répertoire"),
      `${chemin} doit expliquer l'état du compte`,
    ).toBeVisible({ timeout: 30_000 });
    // Never the technical failure message.
    await expect(avocat.getByText("Le chargement a échoué")).toHaveCount(0);
  }
  await avocat.context().close();
});

/**
 * Expense form validation (REC-E2E-041): amounts with spaces, and submitting an incomplete form.
 */
test("un montant écrit avec des espaces est accepté, comme on l'écrit partout", async ({ page }) => {
  await seConnecter(page, "avocat.test");
  await page.goto("/frais/nouvelle");

  const reference = `FAC-E2E-${suffixe()}`;
  await choisirDossier(page, "frais-dossier");
  await page.locator("#frais-reference").fill(reference);
  // The button must not stay disabled without explanation.
  await page.locator("#frais-montant").fill("1 250 000");
  await page
    .locator('input[name="piece-justificative"]')
    .setInputFiles({ name: "facture-espaces.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(page.getByText("facture-espaces.pdf")).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Déposer", exact: true }).click();
  // Filing succeeds: the expenses page opens, and no message complains about the amount.
  await page.waitForURL(/\/frais$/, { timeout: 60_000 });
  await expect(page.getByText(reference)).toBeVisible({ timeout: 30_000 });

  await page.context().close();
});

/**
 * The submit button is not disabled by incompleteness: the attempt is accepted and what is missing
 * is named field by field.
 */
test("un dépôt les mains vides nomme ce qui manque, au lieu d'un bouton éteint", async ({ page }) => {
  await seConnecter(page, "avocat.test");
  await page.goto("/frais/nouvelle");

  const deposer = page.getByRole("button", { name: "Déposer", exact: true });
  await expect(deposer).toBeEnabled();
  await deposer.click();

  // All four fields complain, each on its own.
  await expect(page.getByText("Choisissez le dossier concerné.")).toBeVisible();
  await expect(page.getByText("Indiquez la référence de la facture.")).toBeVisible();
  await expect(page.getByText("Indiquez le montant demandé.")).toBeVisible();
  await expect(page.getByText("Chargez au moins une pièce justificative.")).toBeVisible();
  // Nothing was sent: still on the form.
  await expect(page).toHaveURL(/\/frais\/nouvelle/);

  /*
   * An unreadable amount is a different error from a missing one, and the message names what is
   * accepted.
   */
  await page.locator("#frais-montant").fill("mille");
  await expect(page.getByText("Indiquez le montant demandé.")).toHaveCount(0);
  await deposer.click();
  await expect(page.getByText(/Le montant doit être un nombre supérieur à zéro/)).toBeVisible();

  // Correcting a field clears its error.
  await page.locator("#frais-reference").fill("FAC-TEST");
  await expect(page.getByText("Indiquez la référence de la facture.")).toHaveCount(0);

  await page.context().close();
});

/**
 * The document row no longer wraps, so a long file name must shrink rather than overflow on mobile.
 * The general overflow test logs in as DJ, who does not file expenses, hence this check.
 */
test("le formulaire de frais ne déborde pas en mobile, nom de fichier long compris", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 720 });
  await seConnecter(page, "avocat.test");
  await page.goto("/frais/nouvelle");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });

  await page
    .locator('input[name="piece-justificative"]')
    .setInputFiles({ name: NOM_LONG, mimeType: "application/pdf", buffer: PDF });
  await expect(page.getByRole("button", { name: `Consulter - ${NOM_LONG}` })).toBeVisible({
    timeout: 30_000,
  });

  const debordement = await page.evaluate(() => {
    const racine = document.documentElement;
    // One-pixel tolerance for layout rounding.
    return Math.max(0, racine.scrollWidth - racine.clientWidth - 1);
  });
  expect(debordement, `le formulaire déborde de ${debordement} px en 375 px`).toBe(0);

  await page.context().close();
});

test("la pièce justificative est signalée obligatoire", async ({ page }) => {
  await seConnecter(page, "avocat.test");
  await page.goto("/frais/nouvelle");

  /*
   * The asterisk is decorative and `aria-hidden`: inside the text, the legend would read
   * "Pièces justificatives*" and stop matching what the user reads.
   */
  const bloc = page.locator("fieldset").filter({ hasText: "Pièces justificatives" });
  await expect(bloc.locator("legend")).toHaveText("Pièces justificatives*");
  await expect(page.getByLabel("Pièce justificative (obligatoire)")).toBeAttached();

  await page.context().close();
});

/**
 * The preview eye sits on the same line as the upload, as in the case creation form, so the link
 * between the chosen file and its preview button is clear.
 */
test("l'aperçu d'une pièce s'affiche sur la même ligne que le téléversement", async ({ page }) => {
  await seConnecter(page, "avocat.test");
  await page.goto("/frais/nouvelle");

  const televersement = page.getByRole("button", { name: "Choisir un fichier" }).first();
  await expect(televersement).toBeVisible();

  // A deliberately long name: short names do not exercise the layout.
  await page
    .locator('input[name="piece-justificative"]')
    .setInputFiles({ name: NOM_LONG, mimeType: "application/pdf", buffer: PDF });
  const apercu = page.getByRole("button", { name: `Consulter - ${NOM_LONG}` });
  await expect(apercu).toBeVisible({ timeout: 30_000 });

  // The name is truncated on screen but readable on hover.
  await expect(page.getByTitle(NOM_LONG)).toBeVisible();

  /*
   * "Same line" is measured: both boxes must overlap vertically. A text assertion says nothing about
   * layout.
   */
  const boiteTeleversement = (await televersement.boundingBox())!;
  const boiteApercu = (await apercu.boundingBox())!;
  const basTeleversement = boiteTeleversement.y + boiteTeleversement.height;
  const basApercu = boiteApercu.y + boiteApercu.height;
  expect(
    Math.min(basTeleversement, basApercu) - Math.max(boiteTeleversement.y, boiteApercu.y),
    "le bouton d'aperçu n'est pas sur la même ligne que le téléversement",
  ).toBeGreaterThan(0);

  await page.context().close();
});

/**
 * Same layout when filing a publication, in both filing types: the preview button must not be a
 * full-width block below the upload.
 */
async function ouvrirDepotPublication(page: Page, nature: "compteRendu" | "document") {
  await page.goto("/publications/nouvelle");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
  if (nature === "document") {
    // Both types are described choices, not tabs: check the wanted one.
    await page.getByRole("radio").nth(1).check();
  }
}

/** Both boxes must overlap vertically: "same line" is measured. */
async function surLaMemeLigne(page: Page, nomFichier: string) {
  const televersement = page.getByRole("button", { name: "Choisir un fichier" }).first();
  const relire = page.getByRole("button", { name: `Consulter - ${nomFichier}` });
  await expect(relire).toBeVisible({ timeout: 30_000 });

  const boiteTeleversement = (await televersement.boundingBox())!;
  const boiteRelire = (await relire.boundingBox())!;
  const chevauchement =
    Math.min(boiteTeleversement.y + boiteTeleversement.height, boiteRelire.y + boiteRelire.height) -
    Math.max(boiteTeleversement.y, boiteRelire.y);
  expect(chevauchement, "le bouton de relecture n'est pas sur la même ligne que le téléversement").toBeGreaterThan(
    0,
  );
}

test("la relecture d'une pièce de compte rendu est sur la même ligne, nom long compris", async ({ page }) => {
  await seConnecter(page, "avocat.test");
  await ouvrirDepotPublication(page, "compteRendu");

  await page
    .locator('input[name="piece-jointe"]')
    .setInputFiles({ name: NOM_LONG, mimeType: "application/pdf", buffer: PDF });

  await surLaMemeLigne(page, NOM_LONG);
  // Truncated on screen, readable on hover.
  await expect(page.getByTitle(NOM_LONG)).toBeVisible();

  await page.context().close();
});

test("la relecture d'un document du dossier est sur la même ligne, nom long compris", async ({ page }) => {
  await seConnecter(page, "avocat.test");
  await ouvrirDepotPublication(page, "document");

  await page
    .locator('input[name="fichier"]')
    .setInputFiles({ name: NOM_LONG, mimeType: "application/pdf", buffer: PDF });

  await surLaMemeLigne(page, NOM_LONG);
  await expect(page.getByTitle(NOM_LONG)).toBeVisible();

  await page.context().close();
});

/**
 * A row that no longer wraps can overflow if the name does not shrink, in both filing types. The
 * general overflow test logs in as DJ, who does not file publications.
 */
test("le dépôt de publication ne déborde pas en mobile, dans les deux natures", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 720 });
  await seConnecter(page, "avocat.test");

  for (const [nature, champ] of [
    ["compteRendu", "piece-jointe"],
    ["document", "fichier"],
  ] as const) {
    await ouvrirDepotPublication(page, nature);
    await page
      .locator(`input[name="${champ}"]`)
      .setInputFiles({ name: NOM_LONG, mimeType: "application/pdf", buffer: PDF });
    await expect(page.getByRole("button", { name: `Consulter - ${NOM_LONG}` })).toBeVisible({
      timeout: 30_000,
    });

    const debordement = await page.evaluate(() => {
      const racine = document.documentElement;
      // One-pixel tolerance for layout rounding.
      return Math.max(0, racine.scrollWidth - racine.clientWidth - 1);
    });
    expect(debordement, `la nature « ${nature} » déborde de ${debordement} px en 375 px`).toBe(0);
  }

  await page.context().close();
});

/**
 * The DJ's correspondence reaches the lawyer: when the DJ or DJA forwards correspondence on a
 * publication, the lawyer must be able to read it, not just be notified. Filing and forwarding go
 * through the API; what the lawyer sees is checked on screen.
 */
test("l'avocat lit sur son espace la correspondance que le DJ lui a transmise", async ({ browser }) => {
  const reference = await creerDossierAffecteALAvocat();
  const avocat = await jeton("avocat.test");

  // Their case, seen from their side: the only way to get its id with their token.
  const mesDossiers = await json<{ content: { id: number; reference: string }[] }>(
    `/avocat/mes-dossiers?reference=${reference}`,
    avocat,
  );
  const dossierId = mesDossiers.content.find((d) => d.reference === reference)?.id;
  expect(dossierId, `le dossier ${reference} doit être visible de l'avocat`).toBeDefined();

  const corps = new FormData();
  corps.append("file", new Blob([PDF], { type: "application/pdf" }), `conclusions-${suffixe()}.pdf`);
  const depot = await fetch(
    `${API}/publications/autres?dossierId=${dossierId}&typeDocument=CONCLUSION`,
    { method: "POST", headers: { Authorization: `Bearer ${avocat}` }, body: corps },
  );
  expect(depot.status, "le dépôt de la publication doit aboutir").toBe(201);
  const publication = (await depot.json()) as { id: number };

  const message = `Merci de préciser la date de l'audience ${suffixe()}.`;
  const transmission = await appel(`/publications/${publication.id}/correspondance`, await jeton("dj.test"), {
    method: "POST",
    body: JSON.stringify({ contenu: message }),
  });
  expect(transmission.status, "la correspondance doit être transmise").toBe(201);

  const page = await pageConnectee(browser, "avocat.test");
  await page.goto("/portail");
  await expect(page.getByRole("heading", { name: "Mon espace", level: 1 })).toBeVisible({ timeout: 30_000 });

  // The column exists and shows the correspondence, signed by whoever forwarded it.
  await expect(
    page.getByRole("columnheader", { name: "Correspondance de la Direction Juridique" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(message)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Transmise par /).first()).toBeVisible();

  await page.context().close();
});

/**
 * What the lawyer's screen must never show. The legal officer never addresses the lawyer directly
 * (US 5.5, RG-INT-07): they comment for the DJ/DJA, who decides and forwards a single
 * correspondence. Internal comments must not appear on the portal.
 */
test("le commentaire interne d'un juriste n'atteint pas le portail de l'avocat", async ({ browser }) => {
  const reference = await creerDossierAffecteALAvocat();
  const avocat = await jeton("avocat.test");

  const mesDossiers = await json<{ content: { id: number; reference: string }[] }>(
    `/avocat/mes-dossiers?reference=${reference}`,
    avocat,
  );
  const dossierId = mesDossiers.content.find((d) => d.reference === reference)?.id;

  const corps = new FormData();
  corps.append("file", new Blob([PDF], { type: "application/pdf" }), `piece-${suffixe()}.pdf`);
  const depot = await fetch(
    `${API}/publications/autres?dossierId=${dossierId}&typeDocument=PIECE`,
    { method: "POST", headers: { Authorization: `Bearer ${avocat}` }, body: corps },
  );
  expect(depot.status).toBe(201);
  const publication = (await depot.json()) as { id: number };

  const interne = `Délibération interne ${suffixe()} : à rejeter selon moi.`;
  const commentaire = await appel(`/publications/${publication.id}/commentaires`, await jeton("juriste.test"), {
    method: "POST",
    body: JSON.stringify({ contenu: interne }),
  });
  expect(commentaire.status, "le juriste doit pouvoir commenter pour le DJ/DJA").toBe(201);

  const page = await pageConnectee(browser, "avocat.test");
  await page.goto("/portail");
  await expect(page.getByRole("heading", { name: "Mon espace", level: 1 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(interne)).toHaveCount(0);

  await page.context().close();
});

/**
 * The lawyer finds Home and notifications in their menu (not only through the logo and bell), and
 * the current tab is marked with `aria-current`.
 */
test("l'avocat a l'accueil et ses notifications dans son menu, et l'onglet suit", async ({ page }) => {
  await seConnecter(page, "avocat.test");
  const menu = page.getByRole("navigation", { name: "Navigation principale" });

  // Both entries exist.
  const accueil = menu.getByRole("link", { name: "Accueil", exact: true });
  const notifications = menu.getByRole("link", { name: "Notifications", exact: true });
  await expect(accueil).toBeVisible();
  await expect(notifications).toBeVisible();

  await notifications.click();
  await page.waitForURL(/\/notifications/, { timeout: 60_000 });
  // The tab claims the current page.
  await expect(notifications, "aucun onglet ne signale la page des notifications")
    .toHaveAttribute("aria-current", "page");

  await accueil.click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
  await expect(accueil, "aucun onglet ne signale la page d'accueil")
    .toHaveAttribute("aria-current", "page");

  // The logo leads to the same place without claiming it: two markers would be noise.
  await expect(menu.getByRole("link", { name: "Afriland First Bank, retour à l’accueil" }))
    .not.toHaveAttribute("aria-current", "page");

  await page.context().close();
});

/**
 * What these two entries do not open: the menu stays that of an external provider. "Dossiers",
 * "Clients" or "Mon compte" would lead to a permission refusal (see `lib/navigation.ts`).
 */
test("le menu de l'avocat ne s'est pas élargi au reste de l'application", async ({ page }) => {
  await seConnecter(page, "avocat.test");
  const menu = page.getByRole("navigation", { name: "Navigation principale" });

  for (const absente of ["Dossiers", "Clients", "Mon compte", "Tableau de bord", "Rapports"]) {
    await expect(
      menu.getByRole("link", { name: absente, exact: true }),
      `« ${absente} » ne doit pas être proposé à l'avocat`,
    ).toHaveCount(0);
  }

  await page.context().close();
});
