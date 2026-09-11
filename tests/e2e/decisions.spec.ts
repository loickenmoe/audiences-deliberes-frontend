import { loadEnvConfig } from "@next/env";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Décisions définitives et base jurisprudentielle (écrans 14 et 38) **contre le backend réel et
 * MinIO**. Les dossiers et l'étape clôturée qu'exige une adjudication sont préparés par l'API.
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
  return fetch(`${API}${chemin}`, {
    ...init,
    headers: { Authorization: `Bearer ${jetonAcces}`, "Content-Type": "application/json", ...init.headers },
  });
}

async function json<T>(chemin: string, jetonAcces: string, init: RequestInit = {}): Promise<T> {
  const reponse = await appel(chemin, jetonAcces, init);
  if (!reponse.ok) throw new Error(`${init.method ?? "GET"} ${chemin} → ${reponse.status} ${await reponse.text()}`);
  return (await reponse.json()) as T;
}

function suffixe() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Un dossier et l'identifiant de son instance, encore « Ouverture ». */
async function dossierCree(): Promise<{ id: number; reference: string; etapeId: number }> {
  const juriste = await jeton("juriste.test");
  const juristes = await json<{ id: number }[]>("/utilisateurs?profil=JURISTE", juriste);
  const avocats = await json<{ id: number }[]>("/intervenants?type=AVOCAT", juriste);
  const clients = await json<{ content: { id: number }[] }>("/clients?size=1", juriste);
  const reference = `DOS-DEF-${suffixe()}`;
  const { id } = await json<{ id: number }>("/dossiers", juriste, {
    method: "POST",
    body: JSON.stringify({
      reference,
      nature: "Assignation en paiement",
      juridictionSaisie: "TGI Douala",
      clientId: clients.content[0]!.id,
      risqueEncouru: 5_000_000,
      dossierCreditOrigine: "CRD-DEF",
      pvTransfert: "PV-DEF",
      juristesAffectes: [juristes[0]!.id],
      avocatsAffectes: [avocats[0]!.id],
    }),
  });
  const dossier = await json<{ etapes: { id: number }[] }>(`/dossiers/${id}`, juriste);
  return { id, reference, etapeId: dossier.etapes[0]!.id };
}

/**
 * L'étape parcourt son cycle jusqu'à « Clôturée » : en cours, en délibéré, délibéré vidé par une
 * décision favorable (seule voie vers « Délibéré vidé », RG-DEL-01), puis clôturée.
 */
async function etapeCloturee(dossierId: number, etapeId: number) {
  const juriste = await jeton("juriste.test");
  const statut = (nouveauStatut: string) =>
    json(`/dossiers/${dossierId}/etapes/${etapeId}/statut`, juriste, {
      method: "PATCH",
      body: JSON.stringify({ nouveauStatut }),
    });
  await statut("EN_COURS");
  await statut("EN_DELIBERE");
  await json(`/dossiers/${dossierId}/deliberes`, juriste, {
    method: "POST",
    body: JSON.stringify({ etapeId, dateDeliberee: aujourdhui(), resultat: "FAVORABLE" }),
  });
  await statut("CLOTURE");
}

function adjudication(etapeId: number, reliquat: number) {
  return JSON.stringify({
    etapeId,
    beneficiaire: "Afriland First Bank",
    statutComptabilisation: "Comptabilisée",
    repriseProvision: true,
    restitutionSoulte: false,
    mutation: false,
    reliquat,
    dateDecision: aujourdhui(),
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

test.setTimeout(240_000);

test("adjudication : refusée hors étape clôturée, reliquat négatif refusé, puis enregistrée", async ({ browser }) => {
  const juriste = await jeton("juriste.test");
  const ouvert = await dossierCree();
  // Le backend refuse une adjudication sur une étape qui n'est pas clôturée (RG-DEF-01).
  const refus = await appel(`/dossiers/${ouvert.id}/adjudications`, juriste, { method: "POST", body: adjudication(ouvert.etapeId, 0) });
  expect(refus.status).toBe(400);

  const clos = await dossierCree();
  await etapeCloturee(clos.id, clos.etapeId);
  const negatif = await appel(`/dossiers/${clos.id}/adjudications`, juriste, { method: "POST", body: adjudication(clos.etapeId, -1) });
  expect(negatif.status).toBe(400);

  const page = await pageConnectee(browser, "juriste.test");
  // Sans étape clôturée, l'action n'est pas proposée et l'écran dit pourquoi.
  await page.goto(`/dossiers/${ouvert.id}?onglet=decisions`);
  await expect(page.getByRole("button", { name: "Enregistrer une adjudication" })).toBeDisabled();
  await expect(page.getByText(/aucune étape de ce dossier n’est encore clôturée/)).toBeVisible();

  await page.goto(`/dossiers/${clos.id}?onglet=decisions`);
  await page.getByRole("button", { name: "Enregistrer une adjudication" }).click();
  const modale = page.getByRole("dialog", { name: "Enregistrer une adjudication" });
  await modale.getByLabel("Bénéficiaire", { exact: true }).fill("Afriland First Bank");
  await modale.getByLabel("Statut de comptabilisation", { exact: true }).fill("Comptabilisée");
  await modale.getByLabel("Reprise de provision", { exact: true }).check();
  await modale.getByLabel("Reliquat (FCFA)", { exact: true }).fill("-5");
  await modale.getByRole("button", { name: "Enregistrer" }).click();
  await expect(modale.getByText("Le reliquat ne peut pas être négatif.")).toBeVisible();
  await modale.getByLabel("Reliquat (FCFA)", { exact: true }).fill("250000");
  await modale.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Adjudication enregistrée.")).toBeVisible();
  const ligne = page.getByRole("row", { name: /Afriland First Bank/ });
  await expect(ligne).toContainText("Reprise de provision");
  await expect(ligne).toContainText("Comptabilisation : Comptabilisée");
  await page.context().close();
});

test("condamnation : suivie, son statut mis à jour puis relu après rechargement ; lecture seule pour l'Assistante", async ({ browser }) => {
  const { id } = await dossierCree();

  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto(`/dossiers/${id}?onglet=decisions`);
  await juriste.getByRole("button", { name: "Suivre une condamnation" }).click();
  const modale = juriste.getByRole("dialog", { name: "Suivre une condamnation" });
  await modale.getByLabel("Sens de la condamnation", { exact: true }).selectOption({ label: "Le tiers est redevable" });
  await modale.getByLabel("Nature du paiement", { exact: true }).fill("Frais de procédure");
  await modale.getByRole("button", { name: "Enregistrer" }).click();
  await expect(juriste.getByText("Condamnation enregistrée.")).toBeVisible();

  const statut = juriste.getByLabel("Statut de paiement — Frais de procédure");
  await expect(statut).toHaveValue("EN_ATTENTE");
  await statut.selectOption("PAYE");
  await juriste.getByRole("row", { name: /Frais de procédure/ }).getByRole("button", { name: "Mettre à jour" }).click();
  await expect(juriste.getByText("Statut de paiement mis à jour.")).toBeVisible();
  // Relu du backend après rechargement : c'est ce que QF-03 rendait impossible.
  await juriste.reload();
  await expect(juriste.getByLabel("Statut de paiement — Frais de procédure")).toHaveValue("PAYE");
  await juriste.context().close();

  const assistante = await pageConnectee(browser, "assistante.test");
  await assistante.goto(`/dossiers/${id}?onglet=decisions`);
  await expect(assistante.getByRole("row", { name: /Frais de procédure/ })).toContainText("Payée");
  await expect(assistante.getByRole("button", { name: "Suivre une condamnation" })).toHaveCount(0);
  await expect(assistante.getByLabel("Statut de paiement — Frais de procédure")).toHaveCount(0);
  await assistante.context().close();
});

test("base jurisprudentielle : indexation incomplète refusée, archivage PDF, recherche partielle, aperçu et téléchargement", async ({ page }) => {
  const marque = `Q89E${suffixe()}`;
  await seConnecter(page, "juriste.test");
  await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Jurisprudence" }).click();
  await page.waitForURL(/\/jurisprudences/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Base jurisprudentielle", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Archiver une décision" }).click();
  const modale = page.getByRole("dialog", { name: "Archiver une décision" });
  await modale.getByRole("button", { name: "Archiver une décision" }).click();
  // Indexation incomplète : rien ne part (RG-DEF-05).
  await expect(modale.getByText("Chargez la décision en PDF.")).toBeVisible();
  await modale.locator('input[name="fichier-jurisprudence"]').setInputFiles({ name: `arret-${marque}.pdf`, mimeType: "application/pdf", buffer: PDF });
  await modale.getByLabel("Type d’archive", { exact: true }).selectOption({ label: "Grosse" });
  await modale.getByLabel("Mots-clés", { exact: true }).fill(`Saisie immobilière ${marque}, hypothèque`);
  await modale.getByLabel("Nature de la décision", { exact: true }).fill("Arrêt");
  await modale.getByLabel("Juridiction", { exact: true }).fill("Cour d’appel du Littoral");
  await modale.getByLabel("Date de la décision", { exact: true }).fill("2026-06-30");
  await modale.getByRole("button", { name: "Archiver une décision" }).click();
  await expect(page.getByText("Décision archivée dans la base jurisprudentielle.")).toBeVisible();

  // Un fragment du mot-clé, en minuscules, suffit (Q-89). Les filtres sont visés par leur identifiant :
  // la modale fermée reste dans le DOM, et son champ « Juridiction » porte le même libellé.
  const motCle = page.locator("#filtre-motCle");
  await motCle.fill(marque.toLowerCase());
  await motCle.press("Enter");
  const ligne = page.getByRole("row", { name: new RegExp(marque) });
  await expect(ligne).toHaveCount(1);
  const juridiction = page.locator("#filtre-juridiction");
  await juridiction.fill("littoral");
  await juridiction.press("Enter");
  await expect(ligne).toHaveCount(1);

  await ligne.getByRole("button", { name: "Consulter — Arrêt, Cour d’appel du Littoral" }).click();
  const apercu = page.getByRole("dialog", { name: /Arrêt-2026-06-30\.pdf/ });
  await expect(apercu.locator("iframe")).toBeVisible();
  // Le bouton ne s'active qu'une fois le fichier récupéré depuis MinIO.
  await expect(apercu.getByRole("button", { name: "Télécharger" })).toBeEnabled();
  // Deux boutons « Fermer » : la croix de l'en-tête et celui du pied — on ferme par le pied.
  await apercu.getByRole("button", { name: "Fermer" }).last().click();

  await motCle.fill("aucune-decision-ne-porte-ce-mot");
  await motCle.press("Enter");
  await expect(page.getByText("Aucune décision ne correspond à cette recherche.")).toBeVisible();
});

test("une décision archivée depuis la fiche y reste listée", async ({ page }) => {
  const { id } = await dossierCree();
  await seConnecter(page, "juriste.test");
  await page.goto(`/dossiers/${id}?onglet=decisions`);
  await expect(page.getByText("Aucune décision archivée sur ce dossier.")).toBeVisible();

  await page.getByRole("button", { name: "Archiver la décision" }).click();
  const modale = page.getByRole("dialog", { name: "Archiver une décision" });
  await modale.locator('input[name="fichier-jurisprudence"]').setInputFiles({ name: "jugement.pdf", mimeType: "application/pdf", buffer: PDF });
  await modale.getByLabel("Type d’archive", { exact: true }).selectOption({ label: "Expédition" });
  await modale.getByLabel("Mots-clés", { exact: true }).fill("recouvrement");
  await modale.getByLabel("Nature de la décision", { exact: true }).fill("Jugement");
  await modale.getByLabel("Juridiction", { exact: true }).fill("TGI Douala");
  await modale.getByLabel("Date de la décision", { exact: true }).fill("2026-05-12");
  await modale.getByRole("button", { name: "Archiver une décision" }).click();
  await expect(page.getByText("Décision archivée dans la base jurisprudentielle.")).toBeVisible();

  const archivees = page.getByRole("region", { name: "Décisions archivées" });
  await expect(archivees.getByRole("row", { name: /TGI Douala/ })).toContainText("Jugement");
});
