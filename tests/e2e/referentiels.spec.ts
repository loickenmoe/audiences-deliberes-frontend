import { expect, test, type Page } from "@playwright/test";

import { ligneDansLaFile } from "./files-de-travail";
import { referenceDuClient } from "./reference-attribuee";

/**
 * Parcours clients et intervenants **contre le backend réel**.
 *
 * Premier jalon où l'application consomme des données métier : ces tests créent de vrais
 * enregistrements dans la base de développement. Chaque référence porte un suffixe aléatoire pour
 * qu'une exécution répétée ne se heurte pas à ses propres doublons.
 */

const MOT_DE_PASSE = "Password1!";

async function seConnecter(page: Page, identifiant: string) {
  await page.goto("/login");
  await page.getByLabel("Identifiant", { exact: true }).fill(identifiant);
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Connexion" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
}

/** Suffixe court et unique : les références du backend sont limitées à 50 caractères. */
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

  // La liste se rafraîchit toute seule : la clé de cache est invalidée après la création.
  const ligne = page.getByRole("row", { name: new RegExp(nom) });
  await expect(ligne).toBeVisible({ timeout: 30_000 });

  // La référence est attribuée par le système (2026-09-29) : on la lit au lieu de la choisir.
  const reference = await referenceDuClient(ligne);
  expect(reference).toMatch(/^CLI-\d{4}-\d{4,}$/);

  // Le filtre passe par l'URL : le lien de recherche doit être partageable.
  await page.getByLabel("Référence client").fill(reference);
  await page.getByLabel("Nom du client").click();
  await expect(page).toHaveURL(new RegExp(`reference=${reference}`));
  await expect(page.getByRole("link", { name: reference })).toBeVisible();
});

/*
 * Le doublon de référence client n'existe plus : le système l'attribue depuis le 2026-09-29. Ce
 * parcours vérifie ce qui remplace la garantie perdue — deux clients créés à la suite portent deux
 * références distinctes, et la seconde suit la première.
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

  // Et elles se suivent : le compteur avance d'un, il ne saute pas et ne recule pas.
  const numero = (reference: string) => Number(reference.split("-")[2]);
  expect(numero(references[1])).toEqual(numero(references[0]) + 1);
});

/**
 * PUT /clients (2026-09-22) : un client se corrige depuis sa fiche. La référence reste figée — elle
 * est l'identifiant du client — tandis que le nom et les coordonnées se modifient, et la fiche
 * affiche les nouvelles valeurs sans rechargement.
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
    Depuis le 2026-09-29 la référence n'est plus un champ de ce formulaire : elle est attribuée à la
    création et affichée en texte. Elle reste montrée — savoir lequel on modifie en dépend — mais
    rien ne la saisit, et il n'y a donc plus de contrôle à trouver désactivé.
  */
  await expect(dialogue.getByLabel("Référence", { exact: true })).toHaveCount(0);
  await expect(dialogue.getByText(reference, { exact: true })).toBeVisible();
  await expect(dialogue.getByText("La référence identifie le client : elle ne se modifie pas.")).toBeVisible();

  const nomCorrige = `Nom corrigé ${reference}`;
  await dialogue.getByLabel("Nom", { exact: true }).fill(nomCorrige);
  await dialogue.getByLabel("Courriel").fill("contact@client-e2e.cm");
  await dialogue.getByRole("button", { name: "Enregistrer" }).click();

  // La fiche se rafraîchit d'elle-même : son cache est invalidé après la modification.
  await expect(page.getByRole("heading", { name: nomCorrige, level: 1 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("contact@client-e2e.cm")).toBeVisible();
  await expect(page.getByText(reference, { exact: true })).toBeVisible();
});

test("la vue consolidée regroupe les dossiers par catégorie", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/clients");

  // Prend le premier client de la liste, quel qu'il soit.
  const premier = page.getByRole("link").filter({ hasText: /^CLI/ }).first();
  await premier.click();
  // En développement, l'URL ne change qu'à l'arrivée de la charge RSC : ~5 s serveur chaud,
  // davantage au premier accès à la route. Le défaut de 5 s de Playwright y suffit rarement.
  await page.waitForURL(/\/clients\/\d+/, { timeout: 60_000 });

  // L'écran attend **deux** requêtes (le client, puis ses dossiers) avant de sortir de son état de
  // chargement. Au premier accès à la route, en développement, cela dépasse les 5 s par défaut.
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
   * Le référentiel est trié par nom et paginé : un avocat qu'on vient de créer n'est en première page
   * que si son nom s'y range. Chaque exécution en ajoute : le jour où « Me Test 0…, 1…, 2… » ont
   * rempli la première page, ce parcours est tombé sans qu'une ligne du produit ait changé. On
   * parcourt donc les pages, comme pour les files de travail.
   */
  await expect(await ligneDansLaFile(page, nom)).toBeVisible();
});

/**
 * Q-117 : le DJ corrige un avocat depuis sa ligne du référentiel. Le type et l'identifiant de
 * connexion sont affichés mais figés — l'identité se gère dans Keycloak —, le nom et le courriel se
 * corrigent, et la ligne reflète la correction sans rechargement.
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
  // Même raison que la création : on parcourt les pages plutôt que de supposer la première.
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

  // Le nom corrigé change de place dans l'ordre alphabétique : on repart de la première page.
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

  // Un avocat exige un compte applicatif (RG-INT-01).
  await expect(page.getByLabel("Identifiant de connexion", { exact: true })).toBeVisible();

  // Q-119 : le consentement aux canaux externes vaut pour les deux types, coché par défaut pour un
  // avocat, décoché pour un autre prestataire.
  const consentement = page.getByLabel("Accepte les notifications hors de l’application");
  await expect(consentement).toBeChecked();

  // Un autre prestataire n'a pas de compte applicatif (RG-INT-02).
  await page.getByLabel("Type", { exact: true }).selectOption("AUTRE_PRESTATAIRE");
  await expect(page.getByLabel("Identifiant de connexion", { exact: true })).toBeHidden();
  await expect(consentement).toBeVisible();
});

/**
 * Q-119 : le consentement de l'avocat aux notifications externes se retire depuis sa fiche, et il
 * est conservé. Sans lui, aucun SMS, WhatsApp ni courriel personnel ne part vers ses coordonnées.
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
 * Étape 11 — un numéro hors des trois écritures acceptées par le moteur est refusé à la saisie, et
 * un numéro valide est enregistré mis en forme. Sans cela, la faute ne se voyait qu'à l'envoi, sous
 * la forme d'une ligne « non joignable » en supervision.
 */
test("le DJ ne peut pas enregistrer un numéro hors format ; un numéro valide est mis en forme", async ({ page }) => {
  await seConnecter(page, "dj.test");
  await page.goto("/admin/intervenants");

  const marque = suffixe();
  const nom = `Me Numero ${marque}`;
  await page.getByRole("button", { name: "Nouvel intervenant" }).click();
  await page.getByLabel("Nom", { exact: true }).fill(nom);
  await page.getByLabel("Identifiant de connexion", { exact: true }).fill(`avocat.${marque.toLowerCase()}`);

  // Le format attendu est annoncé sous le champ, avant toute erreur.
  await expect(page.getByText(/Cameroun : mobile à neuf chiffres/)).toBeVisible();

  await page.getByLabel("Téléphone", { exact: true }).fill("0699887766");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText(/Numéro invalide/)).toBeVisible();

  // Corrigé, il est accepté puis enregistré à la forme que le moteur attend.
  await page.getByLabel("Téléphone", { exact: true }).fill("699 88 77 66");
  await page.getByRole("button", { name: "Enregistrer" }).click();

  const ligne = await ligneDansLaFile(page, nom);
  await expect(ligne.getByText("+237699887766", { exact: true })).toBeVisible();
});

test("un juriste consulte le référentiel mais ne peut pas y créer", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/admin/intervenants");

  await expect(page.getByRole("heading", { name: "Intervenants", level: 1 })).toBeVisible();
  // La création est réservée au DJ et au DJA (#61) : le bouton n'existe pas pour un juriste.
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
