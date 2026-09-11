import { loadEnvConfig } from "@next/env";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Publications, constitutions et répertoire (écrans 13, 31, 32, 34, 35) **contre le backend réel et
 * MinIO**. L'avocat dépose par l'API (son portail arrive en F16) ; l'Assistante, les juristes, le
 * DJ et le SH agissent à l'écran.
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
  // Un corps multipart pose lui-même son type (avec la frontière des parties).
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

/** L'avocat rattaché à `avocat.test` par son identifiant de connexion (Q-84). */
async function avocatDuCompteTest(): Promise<number> {
  const juriste = await jeton("juriste.test");
  const trouver = async () =>
    (await json<{ id: number; compteKeycloak: string | null }[]>("/intervenants?type=AVOCAT", juriste)).find(
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

/** Un dossier suivi par `juriste.test` et `avocat.test`. */
async function dossier(): Promise<{ id: number; reference: string }> {
  const juriste = await jeton("juriste.test");
  const avocatId = await avocatDuCompteTest();
  const juristes = await json<{ id: number }[]>("/utilisateurs?profil=JURISTE", juriste);
  const clients = await json<{ content: { id: number }[] }>("/clients?size=1", juriste);
  const reference = `DOS-PUB-${suffixe()}`;
  const cree = await json<{ id: number }>("/dossiers", juriste, {
    method: "POST",
    body: JSON.stringify({
      reference,
      nature: "Assignation en paiement",
      juridictionSaisie: "TGI Douala",
      clientId: clients.content[0]!.id,
      risqueEncouru: 5_000_000,
      dossierCreditOrigine: "CRD-PUB",
      pvTransfert: "PV-PUB",
      juristesAffectes: [juristes[0]!.id],
      avocatsAffectes: [avocatId],
    }),
  });
  return { id: cree.id, reference };
}

/** L'avocat dépose une pièce sur le dossier, éventuellement réservée à un utilisateur. */
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

test("l'Assistante valide une pièce : invisible avant, consultable ensuite par le juriste", async ({ browser }) => {
  const { id: dossierId, reference } = await dossier();
  const { id, nom } = await pieceDeposee(dossierId);

  // Non validée, la publication n'existe pas pour le juriste.
  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto(`/publications/${id}`);
  await expect(juriste.getByText("Publication introuvable")).toBeVisible();

  const assistante = await pageConnectee(browser, "assistante.test");
  await menu(assistante).getByRole("link", { name: "Publications" }).click();
  await assistante.waitForURL(/\/publications/, { timeout: 60_000 });
  await expect(assistante.getByRole("button", { name: "À valider" })).toHaveAttribute("aria-pressed", "true");
  await assistante.getByRole("row", { name: new RegExp(reference) }).getByRole("link", { name: `Pièce — ${nom}` }).click();
  await assistante.waitForURL(/\/publications\/\d+$/, { timeout: 60_000 });
  await expect(assistante.getByText(nom, { exact: true })).toBeVisible();
  await assistante.getByRole("region", { name: "Validation" }).getByRole("button", { name: "Valider" }).click();
  await assistante.getByRole("dialog", { name: "Valider la publication ?" }).getByRole("button", { name: "Valider" }).click();
  await expect(assistante.getByText("Publication validée : les juristes sont prévenus.")).toBeVisible();
  await assistante.context().close();

  await juriste.reload();
  await expect(juriste.getByRole("heading", { name: `Pièce — ${nom}`, level: 1 })).toBeVisible();
  // L'onglet de la fiche la liste aussi.
  await juriste.goto(`/dossiers/${dossierId}?onglet=publications`);
  await expect(juriste.getByRole("link", { name: `Pièce — ${nom}` })).toBeVisible();
  await juriste.context().close();
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
  // Le DJ, qui porte aussi ROLE_JURISTE (Q-81), n'a pas de formulaire de commentaire : il écrit la correspondance.
  await expect(dj.getByLabel("Votre commentaire", { exact: true })).toHaveCount(0);
  await echanges.getByLabel("Correspondance", { exact: true }).fill("Merci de nous faire parvenir la pièce signée.");
  await echanges.getByRole("button", { name: "Transmettre à l’avocat" }).click();
  await dj.getByRole("dialog", { name: "Transmettre la correspondance ?" }).getByRole("button", { name: "Transmettre à l’avocat" }).click();
  await expect(dj.getByText("Correspondance transmise à l’avocat.")).toBeVisible();
  await expect(echanges.getByText("Merci de nous faire parvenir la pièce signée.")).toBeVisible();
  await expect(echanges.getByRole("button", { name: "Transmettre à l’avocat" })).toHaveCount(0);
  await dj.context().close();

  // Unique : une seconde correspondance est refusée par le backend.
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
  // Un appel qui résout l'utilisateur courant provisionne le SH : il existe alors dans l'annuaire
  // et peut être désigné. (`GET /constitutions/prestataires` ne le fait pas : il ne lit pas l'appelant.)
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
  await modale.getByLabel("Prestataire", { exact: true }).selectOption({ label: "Me Claire Avocat — Avocat" });
  await modale.getByLabel("Motif de la demande", { exact: true }).fill("Représentation devant le TGI de Douala");
  await modale.getByRole("button", { name: "Soumettre" }).click();
  await expect(juriste.getByText("Demande envoyée au supérieur hiérarchique pour signature.")).toBeVisible();

  const sh = await pageConnectee(browser, "sh.test");
  await menu(sh).getByRole("link", { name: "Constitutions" }).click();
  await sh.waitForURL(/\/constitutions/, { timeout: 60_000 });
  await expect(sh.getByRole("button", { name: "À signer" })).toHaveAttribute("aria-pressed", "true");
  const ligne = sh.getByRole("row", { name: new RegExp(reference) });
  await ligne.getByRole("button", { name: "Signer la constitution — Me Claire Avocat" }).click();
  await sh.getByRole("dialog", { name: "Signer la constitution ?" }).getByRole("button", { name: "Signer" }).click();
  await expect(sh.getByText("Constitution signée : la lettre est dans la GED du dossier.")).toBeVisible();
  await sh.getByRole("button", { name: "Toutes" }).click();
  await expect(sh.getByRole("row", { name: new RegExp(reference) }).getByRole("button", { name: `Lettre de constitution — ${reference}` })).toBeVisible();
  await sh.context().close();

  await juriste.goto(`/dossiers/${dossierId}?onglet=documents`);
  await expect(juriste.getByText(/lettre-constitution-\d+\.pdf/)).toBeVisible();
  await juriste.context().close();
});

test("le répertoire est trié par charge croissante ; le SH ne voit ni publications ni répertoire", async ({ browser }) => {
  const juriste = await pageConnectee(browser, "juriste.test");
  await menu(juriste).getByRole("link", { name: "Répertoire des avocats" }).click();
  await juriste.waitForURL(/\/repertoire\/avocats/, { timeout: 60_000 });
  // `allInnerTexts` n'attend rien : attendre que le tableau ait remplacé l'état de chargement.
  await expect(juriste.locator("tbody tr").first()).toBeVisible();
  const charges = await juriste.locator("tbody tr td:nth-child(4)").allInnerTexts();
  expect(charges.length).toBeGreaterThan(0);
  const nombres = charges.map((texte) => (/^\d+/.exec(texte.trim()) ? Number.parseInt(texte, 10) : 0));
  expect(nombres).toEqual([...nombres].sort((a, b) => a - b));
  await juriste.context().close();

  const sh = await pageConnectee(browser, "sh.test");
  await expect(menu(sh).getByRole("link", { name: "Publications" })).toHaveCount(0);
  await expect(menu(sh).getByRole("link", { name: "Répertoire des avocats" })).toHaveCount(0);
  await sh.goto("/publications");
  await expect(sh.getByRole("heading", { name: "Vous n’avez pas les droits nécessaires" })).toBeVisible();
  await sh.context().close();
});
