import { loadEnvConfig } from "@next/env";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { avocatDeTest } from "./avocat-de-test";
import { ligneDansLaFile } from "./files-de-travail";

/**
 * Publications, appointments and directory (screens 13, 31, 32, 34, 35) against the real backend and
 * MinIO. The lawyer files through the API; the Assistant, legal officers, DJ and SH act on screen.
 */

loadEnvConfig(process.cwd());

const MOT_DE_PASSE = "Password1!";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
);

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
  const entetes: Record<string, string> = { Authorization: `Bearer ${jetonAcces}` };
  // A multipart body sets its own content type (with the part boundary).
  if (!(init.body instanceof FormData)) entetes["Content-Type"] = "application/json";
  return fetch(`${API}${chemin}`, { ...init, headers: { ...entetes, ...init.headers } });
}

async function json<T>(chemin: string, jetonAcces: string, init: RequestInit = {}): Promise<T> {
  const reponse = await appel(chemin, jetonAcces, init);
  if (!reponse.ok) throw new Error(`${init.method ?? "GET"} ${chemin} → ${reponse.status} ${await reponse.text()}`);
  return (await reponse.json()) as T;
}

function suffixe() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** The lawyer linked to `avocat.test` by login identifier. */
async function avocatDuCompteTest(): Promise<number> {
  const juriste = await jeton("juriste.test");
  const trouver = async () =>
    (
      await json<{ content: { id: number; compteKeycloak: string | null }[] }>(
        "/intervenants?type=AVOCAT&size=200",
        juriste,
      )
    ).content.find(
      (a) => a.compteKeycloak === "avocat.test",
    );
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

/** A case followed by `juriste.test` and `avocat.test`. */
async function dossier(): Promise<{ id: number; reference: string }> {
  const juriste = await jeton("juriste.test");
  const avocatId = await avocatDuCompteTest();
  const juristes = await json<{ id: number }[]>("/utilisateurs?profil=JURISTE", juriste);
  const clients = await json<{ content: { id: number }[] }>("/clients?size=1", juriste);
  const cree = await json<{ id: number; reference: string }>("/dossiers", juriste, {
    method: "POST",
    body: JSON.stringify({
      nature: "Assignation en paiement",
      juridictionSaisie: "TGI Douala",
      clientId: clients.content[0]!.id,
      risqueEncouru: 5_000_000,
      dossierCreditOrigine: "CRD-PUB",
      pvTransfert: "PV-PUB",
      juristesAffectes: [juristes[0]!.id],
      avocatsAffectes: [avocatId],
      // At least one party on each side is required.
      parties: { demandeurs: ["AFRILAND FIRST BANK"], defendeurs: ["Débiteur", "Caution"] },
      // Required: the branch comes from the reference data (00002 = Bonanjo).
      codeAgenceOrigine: "00002",
    }),
  });
  // The reference is system-assigned: any value sent would not exist anywhere.
  return { id: cree.id, reference: cree.reference };
}

/** The lawyer files a document on the case, optionally restricted to one user. */
async function pieceDeposee(dossierId: number, restrictionAcces?: number) {
  const nom = `piece-${suffixe().toLowerCase()}.pdf`;
  const corps = new FormData();
  corps.append("file", new Blob([PDF], { type: "application/pdf" }), nom);
  const parametres = new URLSearchParams({ dossierId: String(dossierId), typeDocument: "PIECE" });
  if (restrictionAcces) parametres.set("restrictionAcces", String(restrictionAcces));
  const publication = await json<{ id: number }>(`/publications/autres?${parametres}`, await jeton("avocat.test"), {
    method: "POST",
    body: corps,
  });
  return { id: publication.id, nom };
}

/** A hearing on the case's current step, then the report the lawyer files for it. */
async function compteRenduDepose(dossierId: number): Promise<{ id: number; recit: string }> {
  const juriste = await jeton("juriste.test");
  // Steps are read from the case page: `/etapes` only accepts creation.
  const fiche = await json<{ etapes: { id: number; statutCycleVie: string }[] }>(
    `/dossiers/${dossierId}`,
    juriste,
  );
  const etape = fiche.etapes[0]!;
  if (etape.statutCycleVie !== "EN_COURS") {
    await json(`/dossiers/${dossierId}/etapes/${etape.id}/statut`, juriste, {
      method: "PATCH",
      body: JSON.stringify({ nouveauStatut: "EN_COURS" }),
    });
  }
  const dans7Jours = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const audience = await json<{ id: number }>(`/dossiers/${dossierId}/audiences`, juriste, {
    method: "POST",
    body: JSON.stringify({ datePlanifiee: dans7Jours, etapeId: etape.id, juridiction: "TGI Douala" }),
  });

  const recit = `Recit de l'avocat ${suffixe()}`;
  const corps = new FormData();
  corps.append("dossierId", String(dossierId));
  corps.append("audienceId", String(audience.id));
  corps.append("contenu", recit);
  const publication = await json<{ id: number }>("/publications/cr-audience", await jeton("avocat.test"), {
    method: "POST",
    body: corps,
  });
  return { id: publication.id, recit };
}

async function validee(publicationId: number) {
  await json(`/publications/${publicationId}/validation`, await jeton("assistante.test"), {
    method: "PUT",
    body: JSON.stringify({ statut: "VALIDE" }),
  });
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

function menu(page: Page) {
  return page.getByRole("navigation", { name: "Navigation principale" });
}

test.setTimeout(240_000);

/**
 * A "Pièce" publication stays invisible until validated, unlike a hearing report (see the dedicated
 * journey below, amended RG-INT-06).
 */
test("un document du dossier reste invisible au juriste jusqu'à sa validation", async ({ browser }) => {
  const { id: dossierId, reference } = await dossier();
  const { id, nom } = await pieceDeposee(dossierId);

  // Not validated, the publication does not exist for the legal officer.
  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto(`/publications/${id}`);
  await expect(juriste.getByText("Publication introuvable")).toBeVisible();

  const assistante = await pageConnectee(browser, "assistante.test");
  await menu(assistante).getByRole("link", { name: "Publications" }).click();
  await assistante.waitForURL(/\/publications/, { timeout: 60_000 });
  await expect(assistante.getByRole("button", { name: "À valider" })).toHaveAttribute("aria-pressed", "true");
  const ligne = await ligneDansLaFile(assistante, reference);
  await ligne.getByRole("link", { name: `Pièce - ${nom}` }).click();
  await assistante.waitForURL(/\/publications\/\d+$/, { timeout: 60_000 });
  await expect(assistante.getByText(nom, { exact: true })).toBeVisible();
  await assistante.getByRole("region", { name: "Validation" }).getByRole("button", { name: "Valider" }).click();
  await assistante.getByRole("dialog", { name: "Valider la publication ?" }).getByRole("button", { name: "Valider" }).click();
  await expect(assistante.getByText("Publication validée : les juristes sont prévenus.")).toBeVisible();
  await assistante.context().close();

  await juriste.reload();
  await expect(juriste.getByRole("heading", { name: `Pièce - ${nom}`, level: 1 })).toBeVisible();
  // The case page tab lists it too.
  await juriste.goto(`/dossiers/${dossierId}?onglet=publications`);
  await expect(juriste.getByRole("link", { name: `Pièce - ${nom}` })).toBeVisible();
  await juriste.context().close();
});

/**
 * Amended RG-INT-06: a hearing report is readable by all authorised users as soon as it is filed,
 * and the Assistant only acknowledges receipt. The filing type, not the status, governs access.
 */
test("le compte rendu de l'avocat est lu de tous les habilités dès son dépôt", async ({ browser }) => {
  const { id: dossierId } = await dossier();
  const { id, recit } = await compteRenduDepose(dossierId);

  // The case's legal officer reads it, and the tab lists it as "Déposé".
  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto(`/publications/${id}`);
  await expect(juriste.getByText(recit)).toBeVisible();
  await juriste.goto(`/dossiers/${dossierId}?onglet=publications`);
  const ligne = juriste.getByRole("listitem").filter({ hasText: "Compte rendu" }).first();
  await expect(ligne).toBeVisible();
  await expect(ligne.getByText("Déposé")).toBeVisible();

  // They were notified at filing, without waiting for the Assistant.
  await juriste.goto("/notifications");
  await expect(juriste.getByText(/consultable dès maintenant/).first()).toBeVisible();
  await juriste.context().close();

  // The SH has no specific regime: reads like the others, immediately.
  const sh = await pageConnectee(browser, "sh.test");
  await sh.goto(`/publications/${id}`);
  await expect(sh.getByText(recit)).toBeVisible();
  await sh.context().close();

  // The Assistant does not approve: she acknowledges receipt and cannot reject.
  const assistante = await pageConnectee(browser, "assistante.test");
  await assistante.goto(`/publications/${id}`);
  const panneau = assistante.getByRole("region", { name: "Validation" });
  await expect(panneau.getByRole("button", { name: "Accuser réception" })).toBeVisible();
  await expect(panneau.getByRole("button", { name: "Rejeter" })).toHaveCount(0);
  await panneau.getByRole("button", { name: "Accuser réception" }).click();
  await assistante
    .getByRole("dialog", { name: "Accuser réception du compte rendu ?" })
    .getByRole("button", { name: "Accuser réception" })
    .click();
  await expect(assistante.getByText("Réception du compte rendu accusée.")).toBeVisible();
  await expect(assistante.getByText("Réception accusée").first()).toBeVisible();
  await assistante.context().close();
});

test("un rejet exige son motif, et la publication reste invisible aux juristes", async ({ browser }) => {
  const { id: dossierId } = await dossier();
  const { id } = await pieceDeposee(dossierId);

  const assistante = await pageConnectee(browser, "assistante.test");
  await assistante.goto(`/publications/${id}`);
  await assistante.getByRole("region", { name: "Validation" }).getByRole("button", { name: "Rejeter" }).click();
  const rejet = assistante.getByRole("dialog", { name: "Rejeter la publication" });
  await rejet.getByRole("button", { name: "Rejeter" }).click();
  await expect(rejet.getByText(/obligatoire/i)).toBeVisible();
  await rejet.getByLabel("Motif du rejet", { exact: true }).fill("Pièce illisible");
  await rejet.getByRole("button", { name: "Rejeter" }).click();
  await expect(assistante.getByText("Publication rejetée. Motif : Pièce illisible")).toBeVisible();
  await assistante.context().close();

  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto(`/publications/${id}`);
  await expect(juriste.getByText("Publication introuvable")).toBeVisible();
  await juriste.context().close();
});

test("le commentaire du juriste va au DJ, qui transmet une correspondance unique", async ({ browser }) => {
  const { id: dossierId } = await dossier();
  const { id } = await pieceDeposee(dossierId);
  await validee(id);

  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto(`/publications/${id}`);
  await expect(juriste.getByText("Il est transmis au DJ et à la DJA, jamais directement à l’avocat.")).toBeVisible();
  await juriste.getByLabel("Votre commentaire", { exact: true }).fill("La pièce n’est pas signée.");
  await juriste.getByRole("button", { name: "Envoyer au DJ/DJA" }).click();
  await expect(juriste.getByText("Commentaire transmis au DJ et à la DJA.")).toBeVisible();

  const dj = await pageConnectee(browser, "dj.test");
  await dj.goto(`/publications/${id}`);
  const echanges = dj.getByRole("region", { name: "Échanges" });
  await expect(echanges.getByText("La pièce n’est pas signée.")).toBeVisible();
  // The DJ, who also holds ROLE_JURISTE, has no comment form: they write the correspondence.
  await expect(dj.getByLabel("Votre commentaire", { exact: true })).toHaveCount(0);
  await echanges.getByLabel("Correspondance", { exact: true }).fill("Merci de nous faire parvenir la pièce signée.");
  await echanges.getByRole("button", { name: "Transmettre à l’avocat" }).click();
  await dj.getByRole("dialog", { name: "Transmettre la correspondance ?" }).getByRole("button", { name: "Transmettre à l’avocat" }).click();
  await expect(dj.getByText("Correspondance transmise à l’avocat.")).toBeVisible();
  await expect(echanges.getByText("Merci de nous faire parvenir la pièce signée.")).toBeVisible();
  await expect(echanges.getByRole("button", { name: "Transmettre à l’avocat" })).toHaveCount(0);
  await dj.context().close();

  // Unique: a second correspondence is refused by the backend.
  const seconde = await appel(`/publications/${id}/correspondance`, await jeton("dja.test"), {
    method: "POST",
    body: JSON.stringify({ contenu: "Seconde correspondance" }),
  });
  expect(seconde.status).toBe(409);

  await juriste.reload();
  await expect(juriste.getByText("Merci de nous faire parvenir la pièce signée.")).toBeVisible();
  await juriste.context().close();
});

test("une publication réservée à un autre destinataire affiche un accès restreint, pas une erreur", async ({ browser }) => {
  const sh = await jeton("sh.test");
  // A call resolving the current user provisions the SH in the directory so it can be designated.
  // (`GET /constitutions/prestataires` does not: it does not read the caller.)
  await appel("/alertes/mes-notifications", sh);
  const shId = (await json<{ id: number }[]>("/utilisateurs?profil=SH", await jeton("juriste.test")))[0]!.id;
  const { id: dossierId } = await dossier();
  const { id } = await pieceDeposee(dossierId, shId);
  await validee(id);

  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto(`/publications/${id}`);
  await expect(juriste.getByText("Accès restreint")).toBeVisible();
  await expect(juriste.getByText("L’avocat a réservé cette publication à un autre juriste.")).toBeVisible();
  await juriste.context().close();
});

test("constitution : motif obligatoire, signature du SH, lettre dans la GED du dossier", async ({ browser }) => {
  const { id: dossierId, reference } = await dossier();

  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto(`/dossiers/${dossierId}`);
  await juriste.getByRole("button", { name: "Solliciter un prestataire" }).click();
  const modale = juriste.getByRole("dialog", { name: "Solliciter la constitution d’un prestataire" });
  await modale.getByRole("button", { name: "Soumettre" }).click();
  await expect(modale.getByText(/obligatoire/i).first()).toBeVisible();
  const avocat = (await avocatDeTest()).nom;
  await modale.getByLabel("Prestataire", { exact: true }).selectOption({ label: `${avocat} - Avocat` });
  await modale.getByLabel("Motif de la demande", { exact: true }).fill("Représentation devant le TGI de Douala");
  await modale.getByRole("button", { name: "Soumettre" }).click();
  await expect(juriste.getByText("Demande envoyée au supérieur hiérarchique pour signature.")).toBeVisible();

  const sh = await pageConnectee(browser, "sh.test");
  await menu(sh).getByRole("link", { name: "Constitutions" }).click();
  await sh.waitForURL(/\/constitutions/, { timeout: 60_000 });
  await expect(sh.getByRole("button", { name: "À signer" })).toHaveAttribute("aria-pressed", "true");
  const ligne = await ligneDansLaFile(sh, new RegExp(reference));
  await ligne.getByRole("button", { name: `Signer la constitution - ${avocat}` }).click();
  await sh.getByRole("dialog", { name: "Signer la constitution ?" }).getByRole("button", { name: "Signer" }).click();
  await expect(sh.getByText("Constitution signée : la lettre est dans la GED du dossier.")).toBeVisible();

  /*
   * Signing leads to the document just filed: the letter is stored in the case's document
   * management, and the SH lands on it.
   */
  await sh.waitForURL(new RegExp(`/dossiers/${dossierId}\\?onglet=documents`), { timeout: 60_000 });
  await expect(sh.getByText(/lettre-constitution-\d+\.pdf/)).toBeVisible({ timeout: 30_000 });

  // The queue stays reachable: the redirect chains screens, it does not close a door.
  await sh.goto("/constitutions");
  await sh.getByRole("button", { name: "Toutes" }).click();
  const signee = await ligneDansLaFile(sh, new RegExp(reference));
  await expect(signee.getByRole("button", { name: `Lettre de constitution - ${reference}` })).toBeVisible();
  await sh.context().close();

  await juriste.goto(`/dossiers/${dossierId}?onglet=documents`);
  await expect(juriste.getByText(/lettre-constitution-\d+\.pdf/)).toBeVisible();

  /*
   * The print for pre-printed paper. Its presence proves that the document type set by the backend
   * (free text) matches what the UI expects; only a real journey can guarantee it.
   */
  const ligneLettre = juriste.getByRole("row", { name: /lettre-constitution-\d+\.pdf/ });
  const sansEntete = ligneLettre.getByRole("button", { name: /^Sans en-tête - lettre-constitution/ });
  await expect(sansEntete).toBeVisible();

  const telechargement = juriste.waitForEvent("download");
  await sansEntete.click();
  const fichier = await telechargement;
  expect(fichier.suggestedFilename()).toMatch(/^lettre-constitution-\d+-sans-entete\.pdf$/);

  // The archived document stays downloadable as is: the print is added, it replaces nothing.
  await expect(ligneLettre.getByRole("button", { name: /^Télécharger - lettre-constitution/ })).toBeVisible();
  await juriste.context().close();
});

test("le répertoire est trié par charge croissante ; le SH consulte publications et répertoire", async ({ browser }) => {
  const juriste = await pageConnectee(browser, "juriste.test");
  await menu(juriste).getByRole("link", { name: "Répertoire des avocats" }).click();
  await juriste.waitForURL(/\/repertoire\/avocats/, { timeout: 60_000 });
  // `allInnerTexts` does not wait: wait for the table to replace the loading state.
  await expect(juriste.locator("tbody tr").first()).toBeVisible();
  const charges = await juriste.locator("tbody tr td:nth-child(4)").allInnerTexts();
  expect(charges.length).toBeGreaterThan(0);
  const nombres = charges.map((texte) => (/^\d+/.exec(texte.trim()) ? Number.parseInt(texte, 10) : 0));
  expect(nombres).toEqual([...nombres].sort((a, b) => a - b));
  await juriste.context().close();

  // Since 2026-10-21 the SH consults both screens, without the actions of the other profiles.
  const sh = await pageConnectee(browser, "sh.test");
  await expect(menu(sh).getByRole("link", { name: "Publications" })).toBeVisible();
  await expect(menu(sh).getByRole("link", { name: "Répertoire des avocats" })).toBeVisible();
  await sh.goto("/publications");
  await expect(sh.getByRole("heading", { name: "Publications des avocats", level: 1 })).toBeVisible();
  await sh.goto("/repertoire/avocats");
  await expect(sh.getByRole("heading", { name: "Répertoire des avocats", level: 1 })).toBeVisible();
  await expect(sh.getByRole("button", { name: "Voir son activité" })).toHaveCount(0);
  await sh.context().close();
});

/**
 * Drafting the appointment letter. The hierarchical superior (SH) may edit the letter before
 * signing; traceability records who wrote it last, and an SH edit is named as such. Once signed,
 * the letter is frozen for everyone, SH included: a correction requires a new request.
 */
test("le juriste rédige, le SH corrige, et la signature fige la lettre (Q-124)", async ({
  browser,
}) => {
  const { id: dossierId, reference } = await dossier();

  // The legal officer requests, then drafts.
  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto(`/dossiers/${dossierId}`);
  await juriste.getByRole("button", { name: "Solliciter un prestataire" }).click();
  const modale = juriste.getByRole("dialog", { name: "Solliciter la constitution d’un prestataire" });
  const avocatRattache = (await avocatDeTest()).nom;
  await modale.getByLabel("Prestataire", { exact: true }).selectOption({ label: `${avocatRattache} - Avocat` });
  await modale.getByLabel("Motif de la demande", { exact: true }).fill("Saisie-attribution urgente");
  await modale.getByRole("button", { name: "Soumettre" }).click();
  await expect(juriste.getByText("Demande envoyée au supérieur hiérarchique pour signature.")).toBeVisible();
  /*
   * Drafting opens right after the request. This journey resumes the letter later from the queue,
   * so it closes the dialog, which would otherwise intercept the menu click.
   */
  await juriste
    .getByRole("dialog", { name: "Lettre de constitution" })
    .getByRole("button", { name: "Annuler" })
    .click();

  await menu(juriste).getByRole("link", { name: "Constitutions" }).click();
  await juriste.waitForURL(/\/constitutions/, { timeout: 60_000 });
  const ligneJuriste = await ligneDansLaFile(juriste, reference);
  await ligneJuriste.getByRole("button", { name: "Rédiger la lettre" }).click();

  const lettre = juriste.getByRole("dialog", { name: "Lettre de constitution" });
  // The number is not assigned yet: it is assigned at signature, so none is wasted.
  await expect(lettre.getByText(/Le numéro est attribué à la signature/)).toBeVisible();
  await lettre.getByLabel("Objet", { exact: true }).fill("Constitution aux fins de saisie-attribution");
  await lettre.getByLabel("Corps de la lettre", { exact: true })
    .fill("Nous vous constituons aux fins de saisie-attribution sur les comptes du débiteur.");
  await lettre.getByRole("button", { name: "Enregistrer la lettre" }).click();
  await expect(juriste.getByText("Lettre enregistrée.")).toBeVisible();
  await juriste.context().close();

  // The SH edits before signing: the button drafts, it no longer just views.
  const sh = await pageConnectee(browser, "sh.test");
  await menu(sh).getByRole("link", { name: "Constitutions" }).click();
  await sh.waitForURL(/\/constitutions/, { timeout: 60_000 });
  const ligneSh = await ligneDansLaFile(sh, reference);
  await ligneSh.getByRole("button", { name: "Rédiger la lettre" }).click();

  const lue = sh.getByRole("dialog", { name: "Lettre de constitution" });
  await expect(lue.getByLabel("Objet", { exact: true })).toHaveValue("Constitution aux fins de saisie-attribution");
  // The letter shows its author: here the legal officer who just wrote it.
  await expect(lue.getByText(/Dernière rédaction par/)).toBeVisible();

  await lue.getByLabel("Corps de la lettre", { exact: true })
    .fill("Nous vous constituons aux fins de saisie-attribution, sous les réserves d'usage.");
  await lue.getByRole("button", { name: "Enregistrer la lettre" }).click();
  await expect(sh.getByText("Lettre enregistrée.")).toBeVisible();

  /*
   * The edit is named: whoever reopens the letter sees it was taken over, and by whom, without
   * digging into the history.
   */
  await ligneSh.getByRole("button", { name: "Rédiger la lettre" }).click();
  await expect(sh.getByText(/Corrigée par le supérieur hiérarchique/)).toBeVisible();
  await sh.getByRole("dialog", { name: "Lettre de constitution" })
    .getByRole("button", { name: "Annuler" }).click();

  // Signing freezes the letter.
  await ligneSh.getByRole("button", { name: `Signer la constitution - ${avocatRattache}` }).click();
  await sh.getByRole("dialog", { name: "Signer la constitution ?" }).getByRole("button", { name: "Signer" }).click();
  await expect(sh.getByText("Constitution signée : la lettre est dans la GED du dossier.")).toBeVisible();
  await sh.context().close();

  /*
   * Once signed, the edit path disappears: the legal officer views the signed PDF instead. The
   * server also refuses edits with a 409 if the screen is bypassed.
   */
  const relecture = await pageConnectee(browser, "juriste.test");
  await relecture.goto("/constitutions");
  await relecture.getByRole("button", { name: "Toutes" }).click();
  const ligneFigee = await ligneDansLaFile(relecture, reference);
  // The freeze applies to everyone, SH included.
  await expect(ligneFigee.getByRole("button", { name: "Rédiger la lettre" })).toHaveCount(0);
  await expect(ligneFigee.getByRole("button", { name: `Lettre de constitution - ${reference}` })).toBeVisible();
  await relecture.context().close();
});

/**
 * The letter belongs to its requester. `ROLE_JURISTE` is composite, so the DJ and DJA hold it too,
 * yet nobody may write under someone else's name. The DJ is the witness: the journey checks both
 * what the screen offers and what the server answers if the screen is bypassed.
 */
test("la lettre est à son demandeur : le DJ la lit, le SH la corrige (Q-126)", async ({ browser }) => {
  const { id: dossierId, reference } = await dossier();
  const avocatRattache = (await avocatDeTest()).nom;

  // The legal officer requests and drafts: the letter is theirs.
  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto(`/dossiers/${dossierId}`);
  await juriste.getByRole("button", { name: "Solliciter un prestataire" }).click();
  const modale = juriste.getByRole("dialog", { name: "Solliciter la constitution d’un prestataire" });
  await modale.getByLabel("Prestataire", { exact: true }).selectOption({ label: `${avocatRattache} - Avocat` });
  await modale.getByLabel("Motif de la demande", { exact: true }).fill("Lettre appartenant à son auteur");
  await modale.getByRole("button", { name: "Soumettre" }).click();
  await expect(juriste.getByText("Demande envoyée au supérieur hiérarchique pour signature.")).toBeVisible();
  /*
   * Drafting opens right after the request. This journey resumes the letter later from the queue,
   * so it closes the dialog, which would otherwise intercept the menu click.
   */
  await juriste
    .getByRole("dialog", { name: "Lettre de constitution" })
    .getByRole("button", { name: "Annuler" })
    .click();

  await menu(juriste).getByRole("link", { name: "Constitutions" }).click();
  await juriste.waitForURL(/\/constitutions/, { timeout: 60_000 });
  const ligneJuriste = await ligneDansLaFile(juriste, reference);
  await ligneJuriste.getByRole("button", { name: "Rédiger la lettre" }).click();
  const lettre = juriste.getByRole("dialog", { name: "Lettre de constitution" });
  await lettre.getByLabel("Objet", { exact: true }).fill("Constitution rédigée par son auteur");
  await lettre.getByRole("button", { name: "Enregistrer la lettre" }).click();
  await expect(juriste.getByText("Lettre enregistrée.")).toBeVisible();
  await juriste.context().close();

  // The DJ reads and does not touch.
  const dj = await pageConnectee(browser, "dj.test");
  await dj.goto("/constitutions");
  const ligneDj = await ligneDansLaFile(dj, reference);
  // The screen does not offer writing: the server said so, row by row.
  await expect(ligneDj.getByRole("button", { name: "Rédiger la lettre" })).toHaveCount(0);
  await ligneDj.getByRole("button", { name: "Consulter la lettre" }).click();
  const lue = dj.getByRole("dialog", { name: "Lettre de constitution" });
  await expect(lue.getByLabel("Objet", { exact: true })).toBeDisabled();
  await expect(lue.getByRole("button", { name: "Enregistrer la lettre" })).toHaveCount(0);
  await lue.getByRole("button", { name: "Fermer" }).last().click();
  await dj.context().close();

  /*
   * If the screen is bypassed, the server refuses: that is where the rule lives.
   */
  const demande = await json<{ content: { id: number; referenceDossier: string }[] }>(
    "/constitutions/prestataires?size=100", await jeton("juriste.test"));
  const demandeId = demande.content.find((d) => d.referenceDossier === reference)?.id;
  for (const intrus of ["dj.test", "dja.test"]) {
    const refus = await appel(`/constitutions/prestataires/${demandeId}/lettre`, await jeton(intrus), {
      method: "PUT",
      body: JSON.stringify({
        numero: null, suffixeNumero: "First Bank/DAJR", lieu: "Douala",
        destinataireNom: "Me Intrus", destinataireQualite: "Huissier", destinataireVille: "Douala",
        concerne: "Tentative", objet: "Récrite par un tiers", corps: "Corps récrit.",
        signataire: "La Direction Juridique",
      }),
    });
    expect(refus.status, `${intrus} ne doit pas pouvoir écrire sur la lettre d'un autre`).toBe(403);
  }

  // The SH may edit before signing.
  const sh = await pageConnectee(browser, "sh.test");
  await sh.goto("/constitutions");
  const ligneSh = await ligneDansLaFile(sh, reference);
  await ligneSh.getByRole("button", { name: "Rédiger la lettre" }).click();
  const corrigee = sh.getByRole("dialog", { name: "Lettre de constitution" });
  await corrigee.getByLabel("Corps de la lettre", { exact: true }).fill("Corps repris par le supérieur.");
  await corrigee.getByRole("button", { name: "Enregistrer la lettre" }).click();
  await expect(sh.getByText("Lettre enregistrée.")).toBeVisible();
  await sh.context().close();

  // The author keeps write access, even after the SH's edit.
  const retour = await pageConnectee(browser, "juriste.test");
  await retour.goto("/constitutions");
  const ligneRetour = await ligneDansLaFile(retour, reference);
  await ligneRetour.getByRole("button", { name: "Rédiger la lettre" }).click();
  const relue = retour.getByRole("dialog", { name: "Lettre de constitution" });
  await expect(relue.getByText(/Corrigée par le supérieur hiérarchique/)).toBeVisible();
  await expect(relue.getByLabel("Objet", { exact: true })).toBeEnabled();
  await retour.context().close();
});

/**
 * The Assistant requests and drafts like a legal officer. The letter she creates is hers (same
 * ownership rule), and she drafts but does not sign.
 */
test("l'Assistante sollicite et rédige sa lettre, sans la signer (Q-126)", async ({ browser }) => {
  const { id: dossierId, reference } = await dossier();
  const avocatRattache = (await avocatDeTest()).nom;

  const assistante = await pageConnectee(browser, "assistante.test");
  await expect(menu(assistante).getByRole("link", { name: "Constitutions" })).toBeVisible();

  await assistante.goto(`/dossiers/${dossierId}`);
  await assistante.getByRole("button", { name: "Solliciter un prestataire" }).click();
  const modale = assistante.getByRole("dialog", { name: "Solliciter la constitution d’un prestataire" });
  await modale.getByLabel("Prestataire", { exact: true }).selectOption({ label: `${avocatRattache} - Avocat` });
  await modale.getByLabel("Motif de la demande", { exact: true }).fill("Sollicitation de l'Assistante");
  await modale.getByRole("button", { name: "Soumettre" }).click();
  await expect(assistante.getByText("Demande envoyée au supérieur hiérarchique pour signature.")).toBeVisible();
  /*
   * Drafting opens right after the request. This journey resumes the letter later from the queue,
   * so it closes the dialog, which would otherwise intercept the menu click.
   */
  await assistante
    .getByRole("dialog", { name: "Lettre de constitution" })
    .getByRole("button", { name: "Annuler" })
    .click();

  await menu(assistante).getByRole("link", { name: "Constitutions" }).click();
  await assistante.waitForURL(/\/constitutions/, { timeout: 60_000 });
  const ligne = await ligneDansLaFile(assistante, reference);
  await ligne.getByRole("button", { name: "Rédiger la lettre" }).click();
  const lettre = assistante.getByRole("dialog", { name: "Lettre de constitution" });
  await lettre.getByLabel("Objet", { exact: true }).fill("Constitution rédigée par l'Assistante");
  await lettre.getByRole("button", { name: "Enregistrer la lettre" }).click();
  await expect(assistante.getByText("Lettre enregistrée.")).toBeVisible();

  // She drafts, she does not sign: the second signature stays with the hierarchical superior.
  await expect(ligne.getByRole("button", { name: `Signer la constitution - ${avocatRattache}` })).toHaveCount(0);
  await assistante.context().close();

  // Her letter is hers: the legal officer reads it but cannot write it.
  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto("/constitutions");
  const ligneJuriste = await ligneDansLaFile(juriste, reference);
  await expect(ligneJuriste.getByRole("button", { name: "Rédiger la lettre" })).toHaveCount(0);
  await expect(ligneJuriste.getByRole("button", { name: "Consulter la lettre" })).toBeVisible();
  await juriste.context().close();
});

/**
 * The lawyer directory filters search as the user types. The Enter shortcut is kept.
 */
test("le filtre du répertoire des avocats cherche au fil de la frappe", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/repertoire/avocats");

  const champ = page.getByLabel("Rechercher un avocat", { exact: true });
  await champ.fill("Me");
  await expect(page).toHaveURL(/nom=Me/, { timeout: 30_000 });
  await expect(champ, "le filtre a exigé de quitter le champ").toBeFocused();

  await champ.press("Enter");
  await expect(page).toHaveURL(/nom=Me/, { timeout: 30_000 });

  await page.context().close();
});

/**
 * Appointment flow: once the request is saved, the letter drafting opens directly (the letter is
 * created with the request, without a number). The second step (signing leads to the Documents
 * tab) is covered by the "constitution : motif obligatoire…" journey above.
 */
test("enregistrer une sollicitation ouvre aussitôt la rédaction de sa lettre", async ({ browser }) => {
  const { id: dossierId, reference } = await dossier();
  const avocat = (await avocatDeTest()).nom;

  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto(`/dossiers/${dossierId}`);
  await juriste.getByRole("button", { name: "Solliciter un prestataire" }).click();

  const sollicitation = juriste.getByRole("dialog", { name: "Solliciter la constitution d’un prestataire" });
  await sollicitation.getByLabel("Prestataire", { exact: true }).selectOption({ label: `${avocat} - Avocat` });
  await sollicitation
    .getByLabel("Motif de la demande", { exact: true })
    .fill("Représentation devant le TGI de Douala");
  await sollicitation.getByRole("button", { name: "Soumettre" }).click();
  await expect(juriste.getByText("Demande envoyée au supérieur hiérarchique pour signature.")).toBeVisible();

  /*
   * Drafting opens by itself on the request just saved, without leaving the case.
   */
  const redaction = juriste.getByRole("dialog", { name: /Lettre de constitution/ });
  await expect(redaction, "la rédaction ne s'est pas ouverte après l'enregistrement").toBeVisible({
    timeout: 30_000,
  });
  // The request dialog has closed: two stacked dialogs would hide the drafting.
  await expect(sollicitation).toBeHidden();

  /*
   * It is editable immediately: the letter already exists server-side and belongs to its requester.
   * Saving the letter is covered by the "le juriste rédige, le SH corrige…" journey; here we only
   * check that writing is possible.
   */
  const corps = redaction.getByLabel("Corps de la lettre", { exact: true });
  await expect(corps).toBeEnabled();
  await corps.fill(`Nous vous constituons sur le dossier ${reference}.`);
  await expect(redaction.getByRole("button", { name: "Enregistrer la lettre" })).toBeEnabled();

  await juriste.context().close();
});
