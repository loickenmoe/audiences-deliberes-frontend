import { loadEnvConfig } from "@next/env";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Final decisions and case-law base (screens 14 and 38) against the real backend and MinIO. Cases
 * and the closed step an adjudication requires are prepared through the API.
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

/** A case and the id of its proceeding, still "Ouverture". */
async function dossierCree(): Promise<{ id: number; reference: string; etapeId: number }> {
  const juriste = await jeton("juriste.test");
  const juristes = await json<{ id: number }[]>("/utilisateurs?profil=JURISTE", juriste);
  // Paginated response; explicit `size` because the whole directory is searched.
  const avocats = (
    await json<{ content: { id: number }[] }>("/intervenants?type=AVOCAT&size=200", juriste)
  ).content;
  const clients = await json<{ content: { id: number }[] }>("/clients?size=1", juriste);
  const { id, reference } = await json<{ id: number; reference: string }>("/dossiers", juriste, {
    method: "POST",
    body: JSON.stringify({
      nature: "Assignation en paiement",
      juridictionSaisie: "TGI Douala",
      clientId: clients.content[0]!.id,
      risqueEncouru: 5_000_000,
      dossierCreditOrigine: "CRD-DEF",
      pvTransfert: "PV-DEF",
      juristesAffectes: [juristes[0]!.id],
      avocatsAffectes: [avocats[0]!.id],
      // Mandatory.
      parties: { demandeurs: ["AFRILAND FIRST BANK"], defendeurs: ["Débiteur"] },
      // Mandatory: 00002 = Bonanjo.
      codeAgenceOrigine: "00002",
    }),
  });
  const dossier = await json<{ etapes: { id: number }[] }>(`/dossiers/${id}`, juriste);
  return { id, reference, etapeId: dossier.etapes[0]!.id };
}

/**
 * Moves the step to "Clôturée": in progress, under deliberation, deliberation emptied by a
 * favorable decision (the only way to "Délibéré vidé", RG-DEL-01), then closed.
 */
async function etapeCloturee(dossierId: number, etapeId: number) {
  const juriste = await jeton("juriste.test");
  const statut = (nouveauStatut: string) =>
    json(`/dossiers/${dossierId}/etapes/${etapeId}/statut`, juriste, {
      method: "PATCH",
      body: JSON.stringify({ nouveauStatut }),
    });
  await statut("EN_COURS");

  /*
   * A held hearing is required before deliberation (REC-NEG-028), otherwise the backend rejects the
   * transition with a 400. The legal officer's report marks the hearing as held.
   */
  const audience = await json<{ id: number }>(`/dossiers/${dossierId}/audiences`, juriste, {
    method: "POST",
    body: JSON.stringify({ datePlanifiee: aujourdhui(), etapeId, juridiction: "TGI Douala" }),
  });
  await json(`/audiences/${audience.id}/compte-rendu`, juriste, {
    method: "PUT",
    body: JSON.stringify({ compteRendu: "Affaire appelee, mise en delibere." }),
  });

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
  // The backend rejects an adjudication on a step that is not closed (RG-DEF-01).
  const refus = await appel(`/dossiers/${ouvert.id}/adjudications`, juriste, { method: "POST", body: adjudication(ouvert.etapeId, 0) });
  expect(refus.status).toBe(400);

  const clos = await dossierCree();
  await etapeCloturee(clos.id, clos.etapeId);
  const negatif = await appel(`/dossiers/${clos.id}/adjudications`, juriste, { method: "POST", body: adjudication(clos.etapeId, -1) });
  expect(negatif.status).toBe(400);

  const page = await pageConnectee(browser, "juriste.test");
  // Without a closed step, the action is not offered and the screen says why.
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
  const { id, etapeId } = await dossierCree();
  // A conviction is followed on a closed step, like an adjudication.
  await etapeCloturee(id, etapeId);

  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto(`/dossiers/${id}?onglet=decisions`);
  await juriste.getByRole("button", { name: "Suivre une condamnation" }).click();
  const modale = juriste.getByRole("dialog", { name: "Suivre une condamnation" });
  await modale.getByLabel("Sens de la condamnation", { exact: true }).selectOption({ label: "Le tiers est redevable" });
  await modale.getByLabel("Nature du paiement", { exact: true }).fill("Frais de procédure");
  await modale.getByLabel("Étape clôturée", { exact: true }).selectOption({ index: 1 });
  await modale.getByRole("button", { name: "Enregistrer" }).click();
  await expect(juriste.getByText("Condamnation enregistrée.")).toBeVisible();

  const statut = juriste.getByLabel("Statut de paiement - Frais de procédure");
  await expect(statut).toHaveValue("EN_ATTENTE");
  await statut.selectOption("PAYE");
  await juriste.getByRole("row", { name: /Frais de procédure/ }).getByRole("button", { name: "Mettre à jour" }).click();
  await expect(juriste.getByText("Statut de paiement mis à jour.")).toBeVisible();
  // Read back from the backend after reload.
  await juriste.reload();
  await expect(juriste.getByLabel("Statut de paiement - Frais de procédure")).toHaveValue("PAYE");
  await juriste.context().close();

  const assistante = await pageConnectee(browser, "assistante.test");
  await assistante.goto(`/dossiers/${id}?onglet=decisions`);
  await expect(assistante.getByRole("row", { name: /Frais de procédure/ })).toContainText("Payée");
  await expect(assistante.getByRole("button", { name: "Suivre une condamnation" })).toHaveCount(0);
  await expect(assistante.getByLabel("Statut de paiement - Frais de procédure")).toHaveCount(0);
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
  // Incomplete indexing: nothing is sent (RG-DEF-05).
  await expect(modale.getByText("Chargez la décision en PDF.")).toBeVisible();
  await modale.locator('input[name="fichier-jurisprudence"]').setInputFiles({ name: `arret-${marque}.pdf`, mimeType: "application/pdf", buffer: PDF });
  await modale.getByLabel("Type d’archive", { exact: true }).selectOption({ label: "Grosse" });
  await modale.getByLabel("Mots-clés", { exact: true }).fill(`Saisie immobilière ${marque}, hypothèque`);
  await modale.getByLabel("Nature de la décision", { exact: true }).fill("Arrêt");
  await modale.getByLabel("Juridiction", { exact: true }).fill("Cour d’appel du Littoral");
  await modale.getByLabel("Date de la décision", { exact: true }).fill("2026-06-30");
  await modale.getByRole("button", { name: "Archiver une décision" }).click();
  await expect(page.getByText("Décision archivée dans la base jurisprudentielle.")).toBeVisible();

  // A lowercase keyword fragment is enough. Filters are targeted by id: the closed dialog stays in
  // the DOM and its "Juridiction" field has the same label.
  const motCle = page.locator("#filtre-motCle");
  await motCle.fill(marque.toLowerCase());
  await motCle.press("Enter");
  const ligne = page.getByRole("row", { name: new RegExp(marque) });
  await expect(ligne).toHaveCount(1);
  const juridiction = page.locator("#filtre-juridiction");
  await juridiction.fill("littoral");
  await juridiction.press("Enter");
  await expect(ligne).toHaveCount(1);

  await ligne.getByRole("button", { name: "Consulter - Arrêt, Cour d’appel du Littoral" }).click();
  const apercu = page.getByRole("dialog", { name: /Arrêt-2026-06-30\.pdf/ });
  await expect(apercu.locator("iframe")).toBeVisible();
  // The button is enabled only once the file is fetched from MinIO.
  await expect(apercu.getByRole("button", { name: "Télécharger" })).toBeEnabled();
  // Two "Fermer" buttons (header cross and footer): close with the footer one.
  await apercu.getByRole("button", { name: "Fermer" }).last().click();

  await motCle.fill("aucune-decision-ne-porte-ce-mot");
  await motCle.press("Enter");
  await expect(page.getByText("Aucune décision ne correspond à cette recherche.")).toBeVisible();
});

test("une décision archivée depuis la fiche y reste listée", async ({ page }) => {
  const { id, etapeId } = await dossierCree();
  /*
   * The step must be closed before archiving: a decision joins the case-law base only once final,
   * all appeals exhausted (REC-NEG-034).
   */
  await etapeCloturee(id, etapeId);
  await seConnecter(page, "juriste.test");
  await page.goto(`/dossiers/${id}?onglet=decisions`);
  await expect(page.getByText("Aucune décision archivée sur ce dossier.")).toBeVisible();

  // "Archiver à la jurisprudence": it feeds the case-law base, not an internal case filing.
  await page.getByRole("button", { name: "Archiver à la jurisprudence" }).click();
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

/**
 * Search-as-you-type on the case-law base: the three filters search by themselves after a pause.
 * Enter still searches immediately.
 */
test("les filtres de la base jurisprudentielle cherchent au fil de la frappe", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/jurisprudences");

  const motCle = page.getByLabel("Mot-clé", { exact: true });
  await motCle.fill("bail");
  await expect(page).toHaveURL(/motCle=bail/, { timeout: 30_000 });
  await expect(motCle, "le filtre a exigé de quitter le champ").toBeFocused();

  // By id, not label: the closed archiving `<dialog>` stays in the DOM with its own "Juridiction" field.
  // Enter searches without waiting for the pause.
  const juridiction = page.locator("#filtre-juridiction");
  await juridiction.fill("TPI");
  await juridiction.press("Enter");
  await expect(page).toHaveURL(/juridiction=TPI/, { timeout: 30_000 });

  await page.context().close();
});

/**
 * The decision can be previewed before archiving: an archived decision becomes case law and cannot
 * be corrected, so reviewing it avoids archiving the wrong document.
 */
test("la décision chargée se relit avant d'être archivée", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/jurisprudences");
  await page.getByRole("button", { name: "Archiver une décision" }).click();

  const modale = page.getByRole("dialog", { name: "Archiver une décision" });
  // No file loaded, nothing to preview: no dead button.
  await expect(modale.getByRole("button", { name: /^Consulter - / })).toHaveCount(0);

  const nom = "arret-cour-appel-douala-chambre-civile-septembre-2026.pdf";
  await modale
    .locator('input[name="fichier-jurisprudence"]')
    .setInputFiles({ name: nom, mimeType: "application/pdf", buffer: PDF });

  const oeil = modale.getByRole("button", { name: `Consulter - ${nom}` });
  await expect(oeil, "l'œil d'aperçu est absent du formulaire d'archivage").toBeVisible({
    timeout: 30_000,
  });

  // It is on the same line as the upload, long file name included.
  const hauteurTeleversement = await modale.locator('input[name="fichier-jurisprudence"]')
    .evaluate((entree) => entree.closest("div")?.getBoundingClientRect().height ?? 0);
  const boiteOeil = await oeil.boundingBox();
  const boiteNom = await modale.getByText(nom).first().boundingBox();
  expect(boiteOeil, "l'œil n'est pas rendu").not.toBeNull();
  expect(boiteNom, "le nom du fichier n'est pas rendu").not.toBeNull();
  // Two elements on the same line overlap vertically.
  const memeLigne =
    boiteOeil!.y < boiteNom!.y + boiteNom!.height && boiteNom!.y < boiteOeil!.y + boiteOeil!.height;
  expect(memeLigne, `l'œil est passé à la ligne (hauteur ${hauteurTeleversement} px)`).toBe(true);

  // It opens the decision without leaving or submitting the form.
  await oeil.click();
  await expect(page.getByRole("dialog", { name: `Aperçu - ${nom}` })).toBeVisible({ timeout: 30_000 });

  await page.context().close();
});

/**
 * The preview's close cross closes only the preview, not the archiving form (which would lose the
 * indexing already entered).
 */
test("la croix de l'aperçu laisse le formulaire d'archivage ouvert", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/jurisprudences");
  await page.getByRole("button", { name: "Archiver une décision" }).click();

  const archivage = page.getByRole("dialog", { name: "Archiver une décision" });
  const nom = "arret-a-relire.pdf";
  await archivage
    .locator('input[name="fichier-jurisprudence"]')
    .setInputFiles({ name: nom, mimeType: "application/pdf", buffer: PDF });

  // Indexing in progress: this is what must not be lost.
  await archivage.getByLabel("Juridiction", { exact: true }).fill("Cour d’appel de Douala");

  await archivage.getByRole("button", { name: `Consulter - ${nom}` }).click();
  const apercu = page.getByRole("dialog", { name: `Aperçu - ${nom}` });
  await expect(apercu).toBeVisible({ timeout: 30_000 });

  // The cross is the first button in the dialog; the footer "Fermer" button is the second.
  await apercu.getByRole("button", { name: "Fermer" }).first().click();

  await expect(apercu).toBeHidden({ timeout: 30_000 });
  await expect(archivage, "la croix a emporté le formulaire d'archivage").toBeVisible();
  await expect(archivage.getByLabel("Juridiction", { exact: true })).toHaveValue("Cour d’appel de Douala");

  await page.context().close();
});

/**
 * A newly opened case has no decision: following a conviction requires a closed step (like an
 * adjudication), and archiving to case law requires a closed case. The screen says so and the
 * server rejects it.
 */
test("à l'étape Ouverture, ni condamnation à suivre ni décision à archiver", async ({ browser }) => {
  const { id } = await dossierCree();

  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto(`/dossiers/${id}?onglet=decisions`);
  await expect(juriste.getByRole("button", { name: "Suivre une condamnation" })).toBeDisabled({ timeout: 30_000 });
  await expect(juriste.getByRole("button", { name: "Archiver à la jurisprudence" })).toBeDisabled();
  await expect(juriste.getByText(/Une condamnation se suit une fois l’étape clôturée/)).toBeVisible();
  await expect(juriste.getByText(/toutes les étapes de ce dossier doivent être clôturées/)).toBeVisible();
  await juriste.context().close();

  // And the server rejects it, even if the screen is bypassed.
  const refus = await appel(`/dossiers/${id}/condamnations`, await jeton("juriste.test"), {
    method: "POST",
    body: JSON.stringify({ sens: "TIERS_REDEVABLE", naturePaiement: "Frais", dateDecision: "2026-10-15" }),
  });
  expect(refus.status, "une condamnation sans étape clôturée doit être refusée").toBe(400);
});
