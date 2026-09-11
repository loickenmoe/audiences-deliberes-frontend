import { expect, test, type Page } from "@playwright/test";

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

  const reference = `CLI-E2E-${suffixe()}`;
  const nom = `Client de test ${reference}`;

  await page.getByRole("button", { name: "Nouveau client" }).click();
  await page.getByLabel("Référence", { exact: true }).fill(reference);
  await page.getByLabel("Nom", { exact: true }).fill(nom);
  await page.getByRole("button", { name: "Enregistrer" }).click();

  // La liste se rafraîchit toute seule : la clé de cache est invalidée après la création.
  await expect(page.getByRole("link", { name: reference })).toBeVisible({ timeout: 30_000 });

  // Le filtre passe par l'URL : le lien de recherche doit être partageable.
  await page.getByLabel("Référence client").fill(reference);
  await page.getByLabel("Nom du client").click();
  await expect(page).toHaveURL(new RegExp(`reference=${reference}`));
  await expect(page.getByRole("link", { name: reference })).toBeVisible();
});

test("une référence en doublon est signalée sur le champ concerné", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/clients");

  const reference = `CLI-DUP-${suffixe()}`;

  for (const tentative of [1, 2]) {
    await page.getByRole("button", { name: "Nouveau client" }).click();
    await page.getByLabel("Référence", { exact: true }).fill(reference);
    await page.getByLabel("Nom", { exact: true }).fill(`Doublon ${tentative}`);
    await page.getByRole("button", { name: "Enregistrer" }).click();

    if (tentative === 1) {
      await expect(page.getByRole("link", { name: reference })).toBeVisible({ timeout: 30_000 });
    }
  }

  /**
   * Le doublon doit s'afficher **sur le champ référence**, pas dans un bandeau générique : sur un
   * formulaire de vingt champs, l'utilisateur doit savoir lequel corriger.
   *
   * Le backend renvoie ici `ERR-CONFLICT` — et non `ERR-002`, réservé aux dossiers — en nommant le
   * champ fautif dans `champ` (QF-21). Ce parcours vérifie la chaîne complète : nom du champ produit
   * par le backend, transporté par `ErreurApi`, posé sur le bon contrôle par `appliquerErreurApi`.
   */
  const champ = page.getByLabel("Référence", { exact: true });
  await expect(champ).toHaveAttribute("aria-invalid", "true", { timeout: 30_000 });
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
  await page.getByLabel("Compte applicatif", { exact: true }).fill(`avocat.${marque.toLowerCase()}`);
  await page.getByRole("button", { name: "Enregistrer" }).click();

  await expect(page.getByRole("cell", { name: nom })).toBeVisible({ timeout: 30_000 });
});

test("le formulaire s'adapte au type d'intervenant", async ({ page }) => {
  await seConnecter(page, "dj.test");
  await page.goto("/admin/intervenants");

  await page.getByRole("button", { name: "Nouvel intervenant" }).click();

  // Un avocat exige un compte applicatif (RG-INT-01).
  await expect(page.getByLabel("Compte applicatif", { exact: true })).toBeVisible();

  // Un autre prestataire n'en a pas : il est notifié par courriel (RG-INT-02).
  await page.getByLabel("Type", { exact: true }).selectOption("AUTRE_PRESTATAIRE");
  await expect(page.getByLabel("Compte applicatif", { exact: true })).toBeHidden();
  await expect(page.getByLabel("Notifier par courriel")).toBeVisible();
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
