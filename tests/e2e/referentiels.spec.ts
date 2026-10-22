import { expect, test, type Page } from "@playwright/test";

import { ligneDansLaFile } from "./files-de-travail";
import { referenceDuClient } from "./reference-attribuee";

/**
 * Client and party journeys against the real backend. These tests create real records in the
 * development database; each reference carries a random suffix so repeated runs do not collide.
 */

const MOT_DE_PASSE = "Password1!";

async function seConnecter(page: Page, identifiant: string) {
  await page.goto("/login");
  await page.getByLabel("Identifiant", { exact: true }).fill(identifiant);
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Connexion" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
}

/** Short unique suffix: backend references are limited to 50 characters. */
function suffixe() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

test("un juriste accède aux clients et aux intervenants depuis la navigation", async ({ page }) => {
  await seConnecter(page, "juriste.test");

  const navigation = page.getByRole("navigation", { name: "Navigation principale" });
  await expect(navigation.getByRole("link", { name: "Clients" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Intervenants" })).toBeVisible();

  await navigation.getByRole("link", { name: "Clients" }).click();
  await page.waitForURL(/\/clients/);
  await expect(page.getByRole("heading", { name: "Clients", level: 1 })).toBeVisible();
});

test("un juriste crée un client et le retrouve par sa référence", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/clients");

  const nom = `Client de test ${suffixe()}`;

  await page.getByRole("button", { name: "Nouveau client" }).click();
  await page.getByLabel("Nom", { exact: true }).fill(nom);
  await page.getByRole("button", { name: "Enregistrer" }).click();

  // The list refreshes itself: the cache key is invalidated after creation.
  const ligne = page.getByRole("row", { name: new RegExp(nom) });
  await expect(ligne).toBeVisible({ timeout: 30_000 });

  // The reference is system-assigned: read it instead of choosing it.
  const reference = await referenceDuClient(ligne);
  expect(reference).toMatch(/^CLI-\d{4}-\d{4,}$/);

  // The filter goes through the URL: the search link must be shareable.
  await page.getByLabel("Référence client").fill(reference);
  await page.getByLabel("Nom du client").click();
  await expect(page).toHaveURL(new RegExp(`reference=${reference}`));
  await expect(page.getByRole("link", { name: reference })).toBeVisible();
});

/*
 * Client references are system-assigned: two clients created in a row get two distinct
 * references, the second following the first.
 */
test("deux clients créés à la suite reçoivent deux références distinctes", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/clients");

  const references: string[] = [];
  for (const rang of [1, 2]) {
    const nom = `Client suite ${rang} ${suffixe()}`;
    await page.getByRole("button", { name: "Nouveau client" }).click();
    await page.getByLabel("Nom", { exact: true }).fill(nom);
    await page.getByRole("button", { name: "Enregistrer" }).click();

    const ligne = page.getByRole("row", { name: new RegExp(nom) });
    await expect(ligne).toBeVisible({ timeout: 30_000 });
    references.push(await referenceDuClient(ligne));
  }

  expect(references[0]).not.toEqual(references[1]);

  /*
   * The counter moves forward: the second reference is strictly greater than the first. Not
   * necessarily "first plus one": concurrent creations (including parallel tests) get distinct,
   * non-consecutive numbers. A number is never served twice and the counter never goes back.
   */
  const numero = (reference: string) => Number(reference.split("-")[2]);
  expect(numero(references[1])).toBeGreaterThan(numero(references[0]));
});

/**
 * PUT /clients: a client is edited from its page. The reference (the client identifier) is frozen;
 * name and contact details change, and the page shows the new values without reloading.
 */
test("un juriste corrige un client depuis sa fiche, sans pouvoir toucher à sa référence", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/clients");

  const nomInitial = `Nom avec coquile ${suffixe()}`;
  await page.getByRole("button", { name: "Nouveau client" }).click();
  await page.getByLabel("Nom", { exact: true }).fill(nomInitial);
  await page.getByRole("button", { name: "Enregistrer" }).click();

  const ligne = page.getByRole("row", { name: new RegExp(nomInitial) });
  await expect(ligne).toBeVisible({ timeout: 30_000 });
  const reference = await referenceDuClient(ligne);
  await page.getByRole("link", { name: reference }).click({ timeout: 30_000 });
  await page.waitForURL(/clients[/][0-9]+/, { timeout: 60_000 });

  await page.getByRole("button", { name: "Modifier" }).click();
  const dialogue = page.getByRole("dialog", { name: "Modifier le client" });
  /*
    The reference is no longer a form field: it is assigned at creation and shown as text, so there
    is no disabled control to find.
  */
  await expect(dialogue.getByLabel("Référence", { exact: true })).toHaveCount(0);
  await expect(dialogue.getByText(reference, { exact: true })).toBeVisible();
  await expect(dialogue.getByText("La référence identifie le client : elle ne se modifie pas.")).toBeVisible();

  const nomCorrige = `Nom corrigé ${reference}`;
  await dialogue.getByLabel("Nom", { exact: true }).fill(nomCorrige);
  await dialogue.getByLabel("Courriel").fill("contact@client-e2e.cm");
  await dialogue.getByRole("button", { name: "Enregistrer" }).click();

  // The page refreshes itself: its cache is invalidated after the update.
  await expect(page.getByRole("heading", { name: nomCorrige, level: 1 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("contact@client-e2e.cm").first()).toBeVisible();
  // `first()`: the dialog just closed stays in the DOM with its own copy of the reference and email.
  // What matters is that the page shows them, not that they are unique.
  await expect(page.getByText(reference, { exact: true }).first()).toBeVisible();
});

test("la vue consolidée regroupe les dossiers par catégorie", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/clients");

  // Takes the first client in the list, whichever it is.
  const premier = page.getByRole("link").filter({ hasText: /^CLI/ }).first();
  await premier.click();
  // In development the URL only changes when the RSC payload arrives: ~5 s warm, longer on first
  // access to the route. Playwright's 5 s default is rarely enough.
  await page.waitForURL(/\/clients\/\d+/, { timeout: 60_000 });

  // The screen waits for two requests (the client, then its cases) before leaving its loading
  // state. On first access in development this exceeds the 5 s default.
  await expect(page.getByRole("heading", { name: "Recouvrement" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Litiges d’exploitation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Retour à la liste des clients" })).toBeVisible();
});

test("le DJ crée un avocat, indispensable à toute création de dossier", async ({ page }) => {
  await seConnecter(page, "dj.test");
  await page.goto("/admin/intervenants");

  const marque = suffixe();
  const nom = `Me Test ${marque}`;

  await page.getByRole("button", { name: "Nouvel intervenant" }).click();
  await page.getByLabel("Nom", { exact: true }).fill(nom);
  await page.getByLabel("Identifiant de connexion", { exact: true }).fill(`avocat.${marque.toLowerCase()}`);
  await page.getByRole("button", { name: "Enregistrer" }).click();

  /*
   * The reference data is sorted by name and paginated: a newly created lawyer is only on the
   * first page if its name sorts there, so pages are walked, as for the work queues.
   */
  await expect(await ligneDansLaFile(page, nom)).toBeVisible();
});

/**
 * The DJ edits a lawyer from its reference data row. Type and login are shown but frozen (identity
 * is managed in Keycloak); name and email are editable, and the row reflects the change without
 * reloading.
 */
test("le DJ corrige un avocat, sans pouvoir changer ni son type ni son identifiant", async ({ page }) => {
  await seConnecter(page, "dj.test");
  await page.goto("/admin/intervenants");

  const marque = suffixe();
  const nom = `Me Coquile ${marque}`;
  await page.getByRole("button", { name: "Nouvel intervenant" }).click();
  await page.getByLabel("Nom", { exact: true }).fill(nom);
  const compte = `avocat.${marque.toLowerCase()}`;
  await page.getByLabel("Identifiant de connexion", { exact: true }).fill(compte);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  // Same reason as creation: walk the pages rather than assume the first one.
  const ligneInitiale = await ligneDansLaFile(page, nom);
  await ligneInitiale.getByRole("button", { name: `Modifier ${nom}` }).click();
  const dialogue = page.getByRole("dialog", { name: "Modifier l’intervenant" });
  await expect(dialogue.getByLabel("Type", { exact: true })).toBeDisabled();
  await expect(dialogue.getByText("Le type ne se modifie pas")).toBeVisible();
  const champCompte = dialogue.getByLabel("Identifiant de connexion", { exact: true });
  await expect(champCompte).toBeDisabled();
  await expect(champCompte).toHaveValue(compte);

  const nomCorrige = `Me Corrigé ${marque}`;
  await dialogue.getByLabel("Nom", { exact: true }).fill(nomCorrige);
  await dialogue.getByLabel("Courriel", { exact: true }).fill("corrige@cabinet-e2e.cm");
  await dialogue.getByRole("button", { name: "Enregistrer" }).click();

  // The corrected name moves in alphabetical order: start again from the first page.
  await expect(dialogue).toBeHidden({ timeout: 30_000 });
  await page.goto("/admin/intervenants");
  const ligne = await ligneDansLaFile(page, nomCorrige);
  await expect(ligne.getByText("corrige@cabinet-e2e.cm", { exact: true })).toBeVisible();
  await expect(ligne.getByText(compte, { exact: true })).toBeVisible();
});

test("le formulaire s'adapte au type d'intervenant", async ({ page }) => {
  await seConnecter(page, "dj.test");
  await page.goto("/admin/intervenants");

  await page.getByRole("button", { name: "Nouvel intervenant" }).click();

  // A lawyer requires an application account (RG-INT-01).
  await expect(page.getByLabel("Identifiant de connexion", { exact: true })).toBeVisible();

  // Consent to external channels applies to both types: checked by default for a lawyer, unchecked
  // for another provider.
  const consentement = page.getByLabel("Accepte les notifications hors de l’application");
  await expect(consentement).toBeChecked();

  // Another provider has no application account (RG-INT-02).
  await page.getByLabel("Type", { exact: true }).selectOption("AUTRE_PRESTATAIRE");
  await expect(page.getByLabel("Identifiant de connexion", { exact: true })).toBeHidden();
  await expect(consentement).toBeVisible();
});

/**
 * The lawyer's consent to external notifications can be withdrawn from their page and is persisted.
 * Without it, no SMS, WhatsApp or personal email is sent to their contact details.
 */
test("le DJ retire le consentement d'un avocat aux notifications externes (Q-119)", async ({ page }) => {
  await seConnecter(page, "dj.test");
  await page.goto("/admin/intervenants");

  const marque = suffixe();
  const nom = `Me Consent ${marque}`;
  await page.getByRole("button", { name: "Nouvel intervenant" }).click();
  await page.getByLabel("Nom", { exact: true }).fill(nom);
  await page.getByLabel("Identifiant de connexion", { exact: true }).fill(`avocat.${marque.toLowerCase()}`);
  await page.getByRole("button", { name: "Enregistrer" }).click();

  const ligne = await ligneDansLaFile(page, nom);
  await ligne.getByRole("button", { name: `Modifier ${nom}` }).click();
  const dialogue = page.getByRole("dialog", { name: "Modifier l’intervenant" });
  const consentement = dialogue.getByLabel("Accepte les notifications hors de l’application");
  await expect(consentement).toBeChecked();

  await consentement.uncheck();
  await dialogue.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialogue).toBeHidden({ timeout: 30_000 });

  await page.goto("/admin/intervenants");
  const relue = await ligneDansLaFile(page, nom);
  await relue.getByRole("button", { name: `Modifier ${nom}` }).click();
  await expect(page.getByRole("dialog", { name: "Modifier l’intervenant" })
    .getByLabel("Accepte les notifications hors de l’application")).not.toBeChecked();
});

/**
 * A number outside the three formats accepted by the notification engine is refused on input, and
 * a valid number is saved normalised.
 */
test("le DJ ne peut pas enregistrer un numéro hors format ; un numéro valide est mis en forme", async ({ page }) => {
  await seConnecter(page, "dj.test");
  await page.goto("/admin/intervenants");

  const marque = suffixe();
  const nom = `Me Numero ${marque}`;
  await page.getByRole("button", { name: "Nouvel intervenant" }).click();
  await page.getByLabel("Nom", { exact: true }).fill(nom);
  await page.getByLabel("Identifiant de connexion", { exact: true }).fill(`avocat.${marque.toLowerCase()}`);

  // The expected format is shown under the field, before any error.
  await expect(page.getByText(/Cameroun : mobile à neuf chiffres/)).toBeVisible();

  await page.getByLabel("Téléphone", { exact: true }).fill("0699887766");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText(/Numéro invalide/)).toBeVisible();

  // Once corrected, it is accepted and saved in the format the engine expects.
  await page.getByLabel("Téléphone", { exact: true }).fill("699 88 77 66");
  await page.getByRole("button", { name: "Enregistrer" }).click();

  const ligne = await ligneDansLaFile(page, nom);
  await expect(ligne.getByText("+237699887766", { exact: true })).toBeVisible();
});

test("un juriste consulte le référentiel mais ne peut pas y créer", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/admin/intervenants");

  await expect(page.getByRole("heading", { name: "Intervenants", level: 1 })).toBeVisible();
  // Creation is restricted to DJ and DJA (#61): the button does not exist for a legal officer.
  await expect(page.getByRole("button", { name: "Nouvel intervenant" })).toHaveCount(0);
});

test("les écrans clients et intervenants sont traduits", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "en", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill("dj.test");
  await page.getByLabel("Password", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });

  await page.goto("/clients");
  await expect(page.getByRole("heading", { name: "Clients", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Client name")).toBeVisible();
  await expect(page.getByRole("button", { name: "New client" })).toBeVisible();

  await page.goto("/admin/intervenants");
  await expect(page.getByRole("heading", { name: "Service providers", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "New provider" })).toBeVisible();
});

/**
 * Client filters search as the user types, and the field keeps the focus (filters are written with
 * `router.replace`).
 */
test("les filtres des clients cherchent au fil de la frappe", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/clients");

  const nom = page.getByLabel("Nom du client", { exact: true });
  await nom.fill("SARL");
  await expect(page).toHaveURL(/nom=SARL/, { timeout: 30_000 });
  await expect(nom, "le filtre a exigé de quitter le champ").toBeFocused();

  const reference = page.getByLabel("Référence client", { exact: true });
  await reference.fill("CLI");
  await expect(page).toHaveURL(/reference=CLI/, { timeout: 30_000 });
  await expect(reference, "le filtre a exigé de quitter le champ").toBeFocused();

  await page.context().close();
});
