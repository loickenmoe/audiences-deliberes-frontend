import { loadEnvConfig } from "@next/env";
import { expect, test, type Browser, type Page } from "@playwright/test";

import { avocatDeTest } from "./avocat-de-test";

/**
 * Document sharing and lawyer notes against the real backend.
 *
 * Rules: the lawyer sees a document if assigned and appointed; any legal officer shares; on a
 * sensitive case the legal officer proposes and the DJ or DJA validates; one note per hearing,
 * separate from the internal report. Setup goes through the API; what each user sees and can do is
 * checked on screen.
 */

loadEnvConfig(process.cwd());

const MOT_DE_PASSE = "Password1!";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");

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

async function appel<T>(chemin: string, compte: string, init: RequestInit = {}): Promise<T> {
  const estFormulaire = init.body instanceof FormData;
  const reponse = await fetch(`${API}${chemin}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await jeton(compte)}`,
      ...(estFormulaire ? {} : { "Content-Type": "application/json" }),
      ...init.headers,
    },
  });
  if (!reponse.ok) throw new Error(`${init.method ?? "GET"} ${chemin} → ${reponse.status} ${await reponse.text()}`);
  const texte = await reponse.text();
  return (texte ? JSON.parse(texte) : null) as T;
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
  const page = await (await browser.newContext({ locale: "fr-FR" })).newPage();
  await seConnecter(page, identifiant);
  return page;
}

interface DossierCree {
  id: number;
  reference: string;
  etapes: { id: number; statutCycleVie: string }[];
}

/** A new case with the test lawyer assigned; appointed and/or sensitive on request. */
async function dossierAvecAvocat({ constitue, sensible = false }: { constitue: boolean; sensible?: boolean }) {
  const avocat = await avocatDeTest();
  const juristes = await appel<{ id: number }[]>("/utilisateurs?profil=JURISTE", "juriste.test");
  const clients = await appel<{ content: { id: number }[] }>("/clients?size=1", "juriste.test");
  const dossier = await appel<DossierCree>("/dossiers", "juriste.test", {
    method: "POST",
    body: JSON.stringify({
      nature: "Assignation en paiement",
      juridictionSaisie: "TGI Douala",
      clientId: clients.content[0]!.id,
      risqueEncouru: 3_000_000,
      dossierCreditOrigine: "CRD-PARTAGE",
      pvTransfert: "PV-PARTAGE",
      juristesAffectes: [juristes[0]!.id],
      avocatsAffectes: [avocat.id],
      parties: { demandeurs: ["AFRILAND FIRST BANK"], defendeurs: ["Débiteur"] },
      codeAgenceOrigine: "00002",
    }),
  });

  if (constitue) {
    const demande = await appel<{ id: number }>("/constitutions/prestataires", "juriste.test", {
      method: "POST",
      body: JSON.stringify({ dossierId: dossier.id, prestataireId: avocat.id, motif: "Représentation" }),
    });
    await appel(`/constitutions/prestataires/${demande.id}/validation`, "sh.test", {
      method: "PUT",
      body: JSON.stringify({ decision: "VALIDEE" }),
    });
  }

  if (sensible) {
    const types = await appel<{ code: string }[]>("/referentiels/types-client-sensible", "juriste.test");
    await appel(`/dossiers/${dossier.id}/sensibilite/proposition`, "juriste.test", {
      method: "POST",
      body: JSON.stringify({ seuilMontant: 1_000_000, typeClientSensible: types[0]!.code, motif: "Client sensible" }),
    });
  }

  const nom = `assignation-${suffixe()}.pdf`;
  const corps = new FormData();
  corps.append("file", new Blob([PDF], { type: "application/pdf" }), nom);
  await appel(`/ged/documents?dossierId=${dossier.id}&typeDocument=AUTRE`, "juriste.test", {
    method: "POST",
    body: corps,
  });
  return { ...dossier, nom };
}

/** The lawyer opens their space and picks the case in "Mes dossiers". */
async function ouvrirMonDossier(page: Page, reference: string) {
  await page.goto("/portail");
  const champ = page.locator("#dossier-espace");
  await champ.click();
  await champ.fill(reference);
  const option = page.getByRole("option", { name: new RegExp(reference) }).first();
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  await champ.press("Escape");
}

/** Nominal case: the legal officer shares, the appointed lawyer reads the document. */
test("une pièce partagée par le juriste se lit dans l'espace de l'avocat constitué", async ({ browser }) => {
  const dossier = await dossierAvecAvocat({ constitue: true });

  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto(`/dossiers/${dossier.id}?onglet=documents`);
  const ligne = juriste.getByRole("row", { name: new RegExp(dossier.nom) });
  await expect(ligne.getByText("Non partagé")).toBeVisible({ timeout: 30_000 });

  await ligne.getByRole("button", { name: `Partager avec l'avocat - ${dossier.nom}` }).click();
  await juriste.getByRole("dialog", { name: "Partager cette pièce avec l'avocat ?" })
    .getByRole("button", { name: "Partager avec l'avocat" }).click();
  await expect(juriste.getByText("Pièce partagée avec l'avocat.")).toBeVisible();
  await expect(ligne.getByText("Partagé", { exact: true })).toBeVisible();
  await juriste.context().close();

  const avocat = await pageConnectee(browser, "avocat.test");
  await ouvrirMonDossier(avocat, dossier.reference);
  await expect(avocat.getByText(dossier.nom)).toBeVisible({ timeout: 30_000 });
  await avocat.getByRole("button", { name: `Consulter - ${dossier.nom}` }).click();
  await expect(avocat.getByRole("dialog", { name: `Aperçu - ${dossier.nom}` })).toBeVisible({ timeout: 30_000 });
  await avocat.context().close();
});

/**
 * Assigned but not appointed: nothing opens, even a shared document, and the screen says why (it is
 * resolved by a signature, not by asking the legal officer).
 */
test("l'avocat affecté mais pas constitué ne voit aucune pièce, et sait pourquoi", async ({ browser }) => {
  const dossier = await dossierAvecAvocat({ constitue: false });
  const documents = await appel<{ content: { id: number; nomFichier: string }[] }>(
    `/dossiers/${dossier.id}/documents`, "juriste.test");
  const piece = documents.content.find((d) => d.nomFichier === dossier.nom)!;
  await appel(`/ged/documents/${piece.id}/partage-avocat`, "juriste.test", { method: "PUT" });

  const avocat = await pageConnectee(browser, "avocat.test");
  await ouvrirMonDossier(avocat, dossier.reference);
  await expect(avocat.getByText("Pas encore constitué")).toBeVisible({ timeout: 30_000 });
  await expect(avocat.getByText(dossier.nom)).toHaveCount(0);
  await avocat.context().close();
});

/**
 * Sensitive case: the legal officer proposes, the lawyer sees nothing; the DJ validates from their
 * queue, and the document appears for the lawyer.
 */
test("sur un dossier sensible, le juriste propose et la pièce n'apparaît qu'après le DJ", async ({ browser }) => {
  const dossier = await dossierAvecAvocat({ constitue: true, sensible: true });

  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto(`/dossiers/${dossier.id}?onglet=documents`);
  const ligne = juriste.getByRole("row", { name: new RegExp(dossier.nom) });
  await ligne.getByRole("button", { name: `Proposer le partage - ${dossier.nom}` }).click({ timeout: 30_000 });
  await juriste.getByRole("dialog", { name: "Proposer le partage de cette pièce ?" })
    .getByRole("button", { name: "Proposer le partage" }).click();
  await expect(juriste.getByText("Partage proposé : il attend la validation du DJ ou de la DJA.")).toBeVisible();
  await expect(ligne.getByText("En attente de validation")).toBeVisible();
  await juriste.context().close();

  // Before validation, the lawyer sees nothing.
  const avocat = await pageConnectee(browser, "avocat.test");
  await ouvrirMonDossier(avocat, dossier.reference);
  await expect(avocat.getByText("Aucune pièce partagée")).toBeVisible({ timeout: 30_000 });

  const dj = await pageConnectee(browser, "dj.test");
  await dj.getByRole("navigation", { name: "Navigation principale" })
    .getByRole("link", { name: "Partages à valider" }).click();
  await dj.waitForURL(/\/ged\/partages-avocat/, { timeout: 60_000 });
  await dj.getByRole("button", { name: `Valider le partage - ${dossier.nom}` }).click({ timeout: 30_000 });
  await dj.getByRole("dialog", { name: "Valider le partage" }).getByRole("button", { name: "Valider le partage" }).click();
  await expect(dj.getByText("Partage validé : la pièce est visible de l'avocat.")).toBeVisible();
  await dj.context().close();

  await ouvrirMonDossier(avocat, dossier.reference);
  await expect(avocat.getByText(dossier.nom)).toBeVisible({ timeout: 30_000 });
  await avocat.context().close();
});

/**
 * Lawyer note: written by the legal officer on a hearing, read by the appointed lawyer. The internal
 * report never reaching the lawyer is guarded server-side (`PortailAvocatPiecesTest`).
 */
test("la note du juriste se lit chez l'avocat constitué", async ({ browser }) => {
  const dossier = await dossierAvecAvocat({ constitue: true });
  const etape = dossier.etapes[0]!;
  await appel(`/dossiers/${dossier.id}/etapes/${etape.id}/statut`, "juriste.test", {
    method: "PATCH",
    body: JSON.stringify({ nouveauStatut: "EN_COURS" }),
  });
  const dans = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  await appel(`/dossiers/${dossier.id}/audiences`, "juriste.test", {
    method: "POST",
    body: JSON.stringify({ etapeId: etape.id, datePlanifiee: dans }),
  });

  const note = `Apportez l'original de l'acte ${suffixe()}`;
  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto(`/dossiers/${dossier.id}?onglet=audiences`);
  await juriste.getByRole("button", { name: /^Note à l'avocat - audience du/ }).first().click({ timeout: 30_000 });
  const modale = juriste.getByRole("dialog", { name: "Note à l'avocat" });
  await modale.getByLabel("Note à l'avocat", { exact: true }).fill(note);
  await modale.getByRole("button", { name: "Enregistrer" }).click();
  await expect(juriste.getByText("Note enregistrée.")).toBeVisible();
  // In the table: the closed box's text area stays in the DOM and holds the same text.
  await expect(juriste.getByRole("table").getByText(note)).toBeVisible();
  await juriste.context().close();

  const avocat = await pageConnectee(browser, "avocat.test");
  await ouvrirMonDossier(avocat, dossier.reference);
  await expect(avocat.getByText(note)).toBeVisible({ timeout: 30_000 });
  await avocat.context().close();
});

/** The share queue is not in the legal officer's menu: validation stays with management. */
test("la file des partages à valider est réservée au DJ et à la DJA", async ({ browser }) => {
  const juriste = await pageConnectee(browser, "juriste.test");
  await expect(
    juriste.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Partages à valider" }),
  ).toHaveCount(0);
  await juriste.context().close();
});

/**
 * The missing appointment is shown to whoever shares: the share takes effect on signature, and the
 * screen must say so.
 */
test("un bandeau prévient qu'aucun avocat n'est constitué, et disparaît une fois constitué", async ({ browser }) => {
  const sansConstitution = await dossierAvecAvocat({ constitue: false });
  const avecConstitution = await dossierAvecAvocat({ constitue: true });
  const bandeau = /Aucun avocat n'est encore constitué sur ce dossier/;

  const juriste = await pageConnectee(browser, "juriste.test");
  await juriste.goto(`/dossiers/${sansConstitution.id}?onglet=documents`);
  await expect(juriste.getByRole("note").filter({ hasText: bandeau })).toBeVisible({ timeout: 30_000 });

  // The confirmation repeats it, where the decision is made.
  await juriste.getByRole("button", { name: `Partager avec l'avocat - ${sansConstitution.nom}` }).click();
  await expect(
    juriste.getByRole("dialog", { name: "Partager cette pièce avec l'avocat ?" })
      .getByText(/visible qu'à la signature de sa lettre de constitution/),
  ).toBeVisible();
  await juriste.getByRole("dialog", { name: "Partager cette pièce avec l'avocat ?" })
    .getByRole("button", { name: "Annuler" }).click();

  await juriste.goto(`/dossiers/${avecConstitution.id}?onglet=documents`);
  await expect(juriste.getByRole("row", { name: new RegExp(avecConstitution.nom) })).toBeVisible({ timeout: 30_000 });
  await expect(juriste.getByRole("note").filter({ hasText: bandeau })).toHaveCount(0);
  await juriste.context().close();
});

/**
 * The SH and the Assistant share too, like the legal officer: the SH shares an ordinary case, the
 * Assistant proposes on a sensitive one.
 */
test("le SH partage un dossier ordinaire, l'Assistante propose sur un dossier sensible", async ({ browser }) => {
  const ordinaire = await dossierAvecAvocat({ constitue: true });
  const sensible = await dossierAvecAvocat({ constitue: true, sensible: true });

  const sh = await pageConnectee(browser, "sh.test");
  await sh.goto(`/dossiers/${ordinaire.id}?onglet=documents`);
  await sh.getByRole("button", { name: `Partager avec l'avocat - ${ordinaire.nom}` }).click({ timeout: 30_000 });
  await sh.getByRole("dialog", { name: "Partager cette pièce avec l'avocat ?" })
    .getByRole("button", { name: "Partager avec l'avocat" }).click();
  await expect(sh.getByText("Pièce partagée avec l'avocat.")).toBeVisible();
  await sh.context().close();

  const assistante = await pageConnectee(browser, "assistante.test");
  await assistante.goto(`/dossiers/${sensible.id}?onglet=documents`);
  await assistante.getByRole("button", { name: `Proposer le partage - ${sensible.nom}` }).click({ timeout: 30_000 });
  await assistante.getByRole("dialog", { name: "Proposer le partage de cette pièce ?" })
    .getByRole("button", { name: "Proposer le partage" }).click();
  await expect(assistante.getByText("Partage proposé : il attend la validation du DJ ou de la DJA.")).toBeVisible();
  // Validation stays with management: no checkbox for the Assistant.
  await expect(assistante.getByRole("button", { name: `Valider le partage - ${sensible.nom}` })).toHaveCount(0);
  await assistante.context().close();
});
