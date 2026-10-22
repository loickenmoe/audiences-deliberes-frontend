import { loadEnvConfig } from "@next/env";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Lawyer fees (screens 28 and 29) against the real backend, with four accounts: the lawyer files
 * through the API, the Assistant, the DJA and the DJ decide on screen.
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
  if (!reponse.ok) throw new Error(`${init.method ?? "GET"} ${chemin} → ${reponse.status} ${await reponse.text()}`);
  return (await reponse.json()) as T;
}

function suffixe() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * The reference-data lawyer linked to the `avocat.test` account, by its login identifier, as the
 * DJ enters it in the participant form.
 */
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
  // 409: a parallel test just created it, including when both creations overlap.
  const cree = await trouver();
  if (cree) return cree.id;
  throw new Error(`POST /intervenants → ${creation.status}`);
}

/**
 * The joint validation threshold, read from the configuration rather than assumed:
 * `SEUIL_MONTANT_DEFAUT` (RG-INT-03) can be changed on screen by the DJ.
 */
async function seuilValidationConjointe(): Promise<number> {
  const configurations = await json<{ cle: string; valeur: string }[]>(
    "/configurations",
    await jeton("dj.test"),
  );
  const seuil = configurations.find((configuration) => configuration.cle === "SEUIL_MONTANT_DEFAUT");
  if (!seuil) throw new Error("SEUIL_MONTANT_DEFAUT absent de la configuration");
  return Number(seuil.valeur);
}

/**
 * An amount well below the threshold, also derived from the configuration. A tenth of the threshold
 * leaves a wide margin.
 */
async function montantSousLeSeuil(): Promise<number> {
  return Math.max(1, Math.floor((await seuilValidationConjointe()) / 10));
}

/** A case to which `avocat.test` is assigned, and its fee request filed through the API. */
async function demandeDeposee(montant: number) {
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
      dossierCreditOrigine: "CRD-FRAIS",
      pvTransfert: "PV-FRAIS",
      juristesAffectes: [juristes[0]!.id],
      avocatsAffectes: [avocatId],
      // Mandatory.
      parties: { demandeurs: ["AFRILAND FIRST BANK"], defendeurs: ["Débiteur", "Caution"] },
      // Mandatory: 00002 = Bonanjo.
      codeAgenceOrigine: "00002",
    }),
  });
  const facture = `FAC-${suffixe()}`;
  const demande = await json<{ id: number }>("/frais/demandes", await jeton("avocat.test"), {
    method: "POST",
    body: JSON.stringify({
      dossierId: dossier.id,
      montant,
      piecesJustificatives: ["facture.pdf", "releve-diligences.pdf"],
      referenceFacture: facture,
    }),
  });
  // The reference is assigned by the server: read the one it returned.
  return { id: demande.id, facture, reference: dossier.reference };
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

/** From the queue, in the default view for this profile. */
async function ouvrirDepuisLaFile(page: Page, facture: string) {
  await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Frais d’avocats" }).click();
  await page.waitForURL(/\/frais/, { timeout: 60_000 });
  await page.getByRole("row", { name: new RegExp(facture) }).getByRole("link", { name: facture }).click();
  await page.waitForURL(/\/frais\/\d+$/, { timeout: 60_000 });
}

async function confirmer(page: Page, action: string, titre: string, succes: string) {
  await page.getByRole("region", { name: "Action attendue" }).getByRole("button", { name: action }).click();
  await page.getByRole("dialog", { name: titre }).getByRole("button", { name: action }).click();
  await expect(page.getByText(succes)).toBeVisible();
}

test.setTimeout(240_000);

test("circuit simple : conformité, opportunité par la DJA seule, paiement", async ({ browser }) => {
  const { facture } = await demandeDeposee(await montantSousLeSeuil());

  const assistante = await pageConnectee(browser, "assistante.test");
  await ouvrirDepuisLaFile(assistante, facture);
  await expect(assistante.getByText("La DJA valide seule")).toBeVisible();
  await expect(assistante.getByText("facture.pdf")).toBeVisible();
  await confirmer(assistante, "Transmettre au contrôle d’opportunité", "Transmettre au contrôle d’opportunité ?", "Demande transmise à la DJA.");

  const dja = await pageConnectee(browser, "dja.test");
  await ouvrirDepuisLaFile(dja, facture);
  await confirmer(dja, "Valider", "Valider la demande ?", "Demande validée.");
  await dja.context().close();

  await assistante.goto("/frais");
  await assistante.getByRole("button", { name: "À payer" }).click();
  await assistante.getByRole("row", { name: new RegExp(facture) }).getByRole("link", { name: facture }).click();
  await confirmer(assistante, "Marquer comme payée", "Marquer la demande comme payée ?", "Paiement enregistré : l’avocat et la Direction Juridique sont notifiés.");
  // Each decision in the workflow is named, with no joint step for this case.
  const circuit = assistante.getByRole("region", { name: "Circuit de validation" });
  await expect(circuit.getByRole("listitem").filter({ hasText: "Contrôle de conformité" })).toContainText("Accord");
  await expect(circuit.getByRole("listitem").filter({ hasText: "Contrôle d’opportunité" })).toContainText("Accord");
  await expect(circuit.getByText("Accord du DJ")).toHaveCount(0);
  await expect(circuit.getByRole("listitem").filter({ hasText: "Paiement" })).toContainText("Payée");
  await assistante.context().close();
});

test("validation conjointe : montant au-delà du seuil, deux accords, jamais deux votes du même profil", async ({ browser }) => {
  // Well above the current threshold, whatever it is: this is the condition under test.
  const { id, facture } = await demandeDeposee((await seuilValidationConjointe()) + 10_000_000);
  await json(`/frais/demandes/${id}/conformite`, await jeton("assistante.test"), {
    method: "PUT",
    body: JSON.stringify({ conforme: true }),
  });

  const dja = await pageConnectee(browser, "dja.test");
  await ouvrirDepuisLaFile(dja, facture);
  await expect(dja.getByText("Validation conjointe du DJ et de la DJA requise")).toBeVisible();
  await dja.getByRole("region", { name: "Action attendue" }).getByRole("button", { name: "Valider" }).click();
  // UC-INT-02 alt. 4-a: the DJA knows before validating that the DJ will be asked.
  const validation = dja.getByRole("dialog", { name: "Valider la demande ?" });
  await expect(validation).toContainText("validation conjointe");
  await validation.getByRole("button", { name: "Valider" }).click();
  await expect(dja.getByText("Validation conjointe déclenchée : le DJ et la DJA sont notifiés.")).toBeVisible();

  await confirmer(dja, "Donner mon accord", "Donner votre accord ?", "Accord enregistré.");
  const actions = dja.getByRole("region", { name: "Action attendue" });
  await expect(actions).toContainText("La demande attend encore celui du DJ.");
  await expect(actions.getByRole("button", { name: "Donner mon accord" })).toHaveCount(0);
  await dja.context().close();

  // And if the UI offered it anyway, the backend would reject the second vote.
  const secondVote = await appel(`/frais/demandes/${id}/validation-conjointe`, await jeton("dja.test"), {
    method: "POST",
    body: JSON.stringify({ accord: true }),
  });
  expect(secondVote.status).toBe(409);

  const dj = await pageConnectee(browser, "dj.test");
  await ouvrirDepuisLaFile(dj, facture);
  const circuit = dj.getByRole("region", { name: "Circuit de validation" });
  await expect(circuit.getByRole("listitem").filter({ hasText: "Accord de la DJA" })).toContainText("Accord");
  await confirmer(dj, "Donner mon accord", "Donner votre accord ?", "Accord enregistré : les deux accords sont réunis, la demande est validée.");
  await expect(dj.locator("header").filter({ hasText: `Demande de frais - facture ${facture}` })).toContainText("Validée");
  await dj.context().close();
});

test("un refus rejette la demande, et son motif est obligatoire", async ({ browser }) => {
  const { facture } = await demandeDeposee(await montantSousLeSeuil());

  const assistante = await pageConnectee(browser, "assistante.test");
  await ouvrirDepuisLaFile(assistante, facture);
  await assistante.getByRole("region", { name: "Action attendue" }).getByRole("button", { name: "Rejeter" }).click();
  const rejet = assistante.getByRole("dialog", { name: "Rejeter la demande" });
  await rejet.getByRole("button", { name: "Rejeter" }).click();
  await expect(rejet.getByText(/obligatoire/i)).toBeVisible();
  await rejet.getByLabel("Motif du rejet", { exact: true }).fill("Relevé de diligences non signé");
  await rejet.getByRole("button", { name: "Rejeter" }).click();

  await expect(assistante.getByText("Demande rejetée : l’avocat est prévenu.")).toBeVisible();
  await expect(assistante.getByText("Demande rejetée. Motif : Relevé de diligences non signé")).toBeVisible();
  await expect(assistante.getByRole("region", { name: "Action attendue" })).toHaveCount(0);
  await assistante.context().close();
});

test("le paiement n'est jamais possible avant la validation ; chaque profil a sa file", async ({ browser }) => {
  const { id, facture } = await demandeDeposee(await montantSousLeSeuil());

  const assistante = await pageConnectee(browser, "assistante.test");
  await expect(assistante.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Frais d’avocats" })).toBeVisible();
  await assistante.goto("/frais");
  await expect(assistante.getByRole("button", { name: "À contrôler" })).toHaveAttribute("aria-pressed", "true");
  await assistante.goto(`/frais/${id}`);
  await expect(assistante.getByRole("heading", { name: `Demande de frais - facture ${facture}`, level: 1 })).toBeVisible();
  await expect(assistante.getByRole("button", { name: "Marquer comme payée" })).toHaveCount(0);
  await assistante.context().close();

  const refus = await appel(`/frais/demandes/${id}/paiement`, await jeton("assistante.test"), { method: "PATCH" });
  expect(refus.status).toBe(400);

  const dj = await pageConnectee(browser, "dj.test");
  await dj.goto("/frais");
  await expect(dj.getByRole("button", { name: "Validation conjointe" })).toHaveAttribute("aria-pressed", "true");
  await expect(dj.getByRole("button", { name: "À contrôler" })).toHaveCount(0);
  await dj.goto(`/frais/${id}`);
  await expect(dj.getByText("Aucune action ne vous revient à cette étape.")).toBeVisible();
  await dj.context().close();

  const juriste = await pageConnectee(browser, "juriste.test");
  await expect(juriste.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Frais d’avocats" })).toHaveCount(0);
  await juriste.goto("/frais");
  await expect(juriste.getByRole("heading", { name: "Vous n’avez pas les droits nécessaires" })).toBeVisible();
  await juriste.context().close();
});
