import { loadEnvConfig } from "@next/env";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { avocatDeTest } from "./avocat-de-test";
import { ligneDansLaFile } from "./files-de-travail";

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

/** Un dossier suivi par `juriste.test` et `avocat.test`. */
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
      // Obligatoires depuis le 2026-10-05 (observations 1 et 3).
      parties: { demandeurs: ["AFRILAND FIRST BANK"], defendeurs: ["Débiteur", "Caution"] },
    }),
  });
  // La référence est ATTRIBUÉE par le système : celle qu'on aurait envoyée n'existe nulle part.
  return { id: cree.id, reference: cree.reference };
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

/** Une audience sur l'étape en cours du dossier, puis le compte rendu que l'avocat en dépose. */
async function compteRenduDepose(dossierId: number): Promise<{ id: number; recit: string }> {
  const juriste = await jeton("juriste.test");
  // Les étapes se lisent sur la fiche du dossier : `/etapes` n'accepte que la création.
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
 * Une « Pièce » est une AUTRE publication : elle garde l'ancien régime, invisible
 * jusqu'à sa validation. Le compte rendu d'audience, lui, ne l'a plus — voir le
 * parcours dédié plus bas (RG-INT-06 amendée, 2026-10-05).
 */
test("un document du dossier reste invisible au juriste jusqu'à sa validation", async ({ browser }) => {
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
  // L'onglet de la fiche la liste aussi.
  await juriste.goto(`/dossiers/${dossierId}?onglet=publications`);
  await expect(juriste.getByRole("link", { name: `Pièce - ${nom}` })).toBeVisible();
  await juriste.context().close();
});

/**
 * RG-INT-06 amendée (métier du 2026-10-05) : un compte rendu d'audience est lu de **tous** les
 * habilités dès son dépôt, et l'Assistante n'en accuse que réception. À comparer au parcours
 * précédent, qui dépose une « Pièce » et reste, lui, fermé jusqu'à validation : c'est la nature du
 * dépôt, et non le statut, qui commande désormais la lecture.
 */
test("le compte rendu de l'avocat est lu de tous les habilités dès son dépôt", async ({ browser }) => {
  const { id: dossierId } = await dossier();
  const { id, recit } = await compteRenduDepose(dossierId);

  // Le juriste du dossier le lit, et l'onglet le liste marqué « Déposé ».
  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto(`/publications/${id}`);
  await expect(juriste.getByText(recit)).toBeVisible();
  await juriste.goto(`/dossiers/${dossierId}?onglet=publications`);
  const ligne = juriste.getByRole("listitem").filter({ hasText: "Compte rendu" }).first();
  await expect(ligne).toBeVisible();
  await expect(ligne.getByText("Déposé")).toBeVisible();

  // Il en a été prévenu au dépôt, sans attendre l'Assistante.
  await juriste.goto("/notifications");
  await expect(juriste.getByText(/consultable dès maintenant/).first()).toBeVisible();
  await juriste.context().close();

  // Le SH n'a aucun régime propre : il lit comme les autres, et tout de suite.
  const sh = await pageConnectee(browser, "sh.test");
  await sh.goto(`/publications/${id}`);
  await expect(sh.getByText(recit)).toBeVisible();
  await sh.context().close();

  // L'Assistante n'approuve pas : elle accuse réception, et ne peut pas rejeter.
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
  await sh.getByRole("button", { name: "Toutes" }).click();
  const signee = await ligneDansLaFile(sh, new RegExp(reference));
  await expect(signee.getByRole("button", { name: `Lettre de constitution - ${reference}` })).toBeVisible();
  await sh.context().close();

  await juriste.goto(`/dossiers/${dossierId}?onglet=documents`);
  await expect(juriste.getByText(/lettre-constitution-\d+\.pdf/)).toBeVisible();

  /*
   * Le tirage pour papier préimprimé (observation métier du 2026-09-25). Sa seule présence prouve
   * que le type de pièce posé par le backend — un texte libre — est bien celui que l'interface
   * attend : aucun typage ne peut garantir cet accord, seul un parcours réel le peut.
   */
  const ligneLettre = juriste.getByRole("row", { name: /lettre-constitution-\d+\.pdf/ });
  const sansEntete = ligneLettre.getByRole("button", { name: /^Sans en-tête - lettre-constitution/ });
  await expect(sansEntete).toBeVisible();

  const telechargement = juriste.waitForEvent("download");
  await sansEntete.click();
  const fichier = await telechargement;
  expect(fichier.suggestedFilename()).toMatch(/^lettre-constitution-\d+-sans-entete\.pdf$/);

  // La pièce archivée reste téléchargeable telle quelle : le tirage s'ajoute, il ne remplace rien.
  await expect(ligneLettre.getByRole("button", { name: /^Télécharger - lettre-constitution/ })).toBeVisible();
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

/**
 * La rédaction de la lettre de constitution (backend Q-115 B2).
 *
 * Ce parcours vérifie la répartition des rôles, qui est tout le sens du jalon : **le juriste rédige,
 * le supérieur hiérarchique consulte** avant de signer. Lui refuser la lecture reviendrait à lui
 * demander de signer sans voir ; lui donner la plume viderait la seconde signature de son sens.
 *
 * Et une fois signée, la lettre est **figée** : elle est partie chez un huissier et figure dans la
 * GED. La retoucher ferait mentir la pièce — une correction passe par une nouvelle demande.
 */
test("le juriste rédige la lettre, le SH la consulte, puis elle est figée (Q-115 B2)", async ({
  browser,
}) => {
  const { id: dossierId, reference } = await dossier();

  // ── Le juriste sollicite, puis rédige ────────────────────────────────────────
  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto(`/dossiers/${dossierId}`);
  await juriste.getByRole("button", { name: "Solliciter un prestataire" }).click();
  const modale = juriste.getByRole("dialog", { name: "Solliciter la constitution d’un prestataire" });
  const avocatRattache = (await avocatDeTest()).nom;
  await modale.getByLabel("Prestataire", { exact: true }).selectOption({ label: `${avocatRattache} - Avocat` });
  await modale.getByLabel("Motif de la demande", { exact: true }).fill("Saisie-attribution urgente");
  await modale.getByRole("button", { name: "Soumettre" }).click();
  await expect(juriste.getByText("Demande envoyée au supérieur hiérarchique pour signature.")).toBeVisible();

  await menu(juriste).getByRole("link", { name: "Constitutions" }).click();
  await juriste.waitForURL(/\/constitutions/, { timeout: 60_000 });
  const ligneJuriste = await ligneDansLaFile(juriste, reference);
  await ligneJuriste.getByRole("button", { name: "Rédiger la lettre" }).click();

  const lettre = juriste.getByRole("dialog", { name: "Lettre de constitution" });
  // Le numéro n'est pas encore attribué : il le sera à la signature, pour ne pas en brûler un.
  await expect(lettre.getByText(/Le numéro est attribué à la signature/)).toBeVisible();
  await lettre.getByLabel("Objet", { exact: true }).fill("Constitution aux fins de saisie-attribution");
  await lettre.getByLabel("Corps de la lettre", { exact: true })
    .fill("Nous vous constituons aux fins de saisie-attribution sur les comptes du débiteur.");
  await lettre.getByRole("button", { name: "Enregistrer la lettre" }).click();
  await expect(juriste.getByText("Lettre enregistrée.")).toBeVisible();
  await juriste.context().close();

  // ── Le SH consulte, sans pouvoir récrire ────────────────────────────────────
  const sh = await pageConnectee(browser, "sh.test");
  await menu(sh).getByRole("link", { name: "Constitutions" }).click();
  await sh.waitForURL(/\/constitutions/, { timeout: 60_000 });
  const ligneSh = await ligneDansLaFile(sh, reference);
  await ligneSh.getByRole("button", { name: "Consulter la lettre" }).click();

  const lue = sh.getByRole("dialog", { name: "Lettre de constitution" });
  await expect(lue.getByLabel("Objet", { exact: true })).toHaveValue("Constitution aux fins de saisie-attribution");
  // Il lit ce qu'il va signer, et rien de plus : aucun champ n'est ouvert, aucun bouton n'enregistre.
  await expect(lue.getByLabel("Objet", { exact: true })).toBeDisabled();
  await expect(lue.getByRole("button", { name: "Enregistrer la lettre" })).toHaveCount(0);
  // Deux boutons portent « Fermer » : la croix de l'en-tête et celui du pied. On vise le second,
  // qui est celui que l'utilisateur atteint après avoir lu — l'ordre du DOM les départage.
  await lue.getByRole("button", { name: "Fermer" }).last().click();

  // ── La signature fige la lettre ─────────────────────────────────────────────
  await ligneSh.getByRole("button", { name: `Signer la constitution - ${avocatRattache}` }).click();
  await sh.getByRole("dialog", { name: "Signer la constitution ?" }).getByRole("button", { name: "Signer" }).click();
  await expect(sh.getByText("Constitution signée : la lettre est dans la GED du dossier.")).toBeVisible();
  await sh.context().close();

  /*
   * Une fois signée, le chemin d'édition **disparaît** : le juriste ne se voit plus proposer de
   * rédiger, et c'est la lettre elle-même — le PDF versé au dossier — qu'il consulte désormais.
   * Le gel n'est donc pas un message à lire, c'est une action qui n'est plus offerte ; le serveur
   * la refuse de son côté par un 409, au cas où l'on passerait outre l'écran.
   */
  const relecture = await pageConnectee(browser, "juriste.test");
  await relecture.goto("/constitutions");
  await relecture.getByRole("button", { name: "Toutes" }).click();
  const ligneFigee = await ligneDansLaFile(relecture, reference);
  await expect(ligneFigee.getByRole("button", { name: "Rédiger la lettre" })).toHaveCount(0);
  await expect(ligneFigee.getByRole("button", { name: `Lettre de constitution - ${reference}` })).toBeVisible();
  await relecture.context().close();
});
