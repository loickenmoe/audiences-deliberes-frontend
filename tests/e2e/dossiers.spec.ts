import { expect, test, type Page } from "@playwright/test";

/**
 * Parcours des dossiers (écrans 05 et 06) **contre le backend réel**.
 *
 * Ces tests créent de vrais dossiers dans la base de développement. Chaque référence porte un
 * suffixe aléatoire pour qu'une exécution répétée ne se heurte pas à ses propres doublons.
 */

const MOT_DE_PASSE = "Password1!";

/** Nature de 71 caractères : elle était refusée par le backend avant la migration V7 (Q-71). */
const NATURE_LONGUE = "Hypothèque judiciaire (inscription provisoire, définitive, réalisation)";
const NATURE_LITIGE = "Civil et commercial";

async function seConnecter(page: Page, identifiant: string) {
  await page.goto("/login");
  await page.getByLabel("Identifiant", { exact: true }).fill(identifiant);
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Connexion" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
}

function suffixe() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Remplit le tronc commun du formulaire, hors pièces conditionnelles. */
async function remplirTroncCommun(page: Page, reference: string, nature: string) {
  await page.getByLabel("Référence", { exact: true }).fill(reference);
  await page.getByLabel("Nature du dossier", { exact: true }).selectOption(nature);
  await page.getByLabel("Juridiction saisie", { exact: true }).fill("TGI Douala");
  await page.getByLabel("Client", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Risque encouru (FCFA)", { exact: true }).fill("5000000");
  await page.getByLabel("Juristes affectés", { exact: true }).selectOption({ index: 0 });
  await page.getByLabel("Avocats affectés", { exact: true }).selectOption({ index: 0 });
}

test("un juriste atteint les dossiers depuis la navigation", async ({ page }) => {
  await seConnecter(page, "juriste.test");

  const navigation = page.getByRole("navigation", { name: "Navigation principale" });
  await navigation.getByRole("link", { name: "Dossiers" }).click();
  await page.waitForURL(/\/dossiers/, { timeout: 60_000 });

  await expect(page.getByRole("heading", { name: "Dossiers", level: 1 })).toBeVisible({
    timeout: 30_000,
  });
});

test("la catégorie est déduite de la nature et commande les pièces exigées", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers/nouveau");

  await page.getByLabel("Nature du dossier", { exact: true }).selectOption(NATURE_LONGUE);

  // Recouvrement : dossier de crédit d'origine ET PV de transfert (Q-11, en ET).
  await expect(page.getByText("Recouvrement", { exact: true }).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByLabel("Dossier de crédit d’origine", { exact: true })).toBeVisible();
  await expect(page.getByLabel("PV de transfert", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Référence de l’incident de compte", { exact: true })).toHaveCount(0);

  // Basculer sur un litige d'exploitation échange les deux paires : ce sont deux jeux distincts,
  // et afficher les quatre laisserait croire qu'ils sont tous exigés.
  await page.getByLabel("Nature du dossier", { exact: true }).selectOption(NATURE_LITIGE);
  await expect(page.getByLabel("Référence de l’incident de compte", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Éléments justificatifs", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Dossier de crédit d’origine", { exact: true })).toHaveCount(0);
});

test("la sensibilité n'exige seuil et type qu'une fois cochée", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers/nouveau");

  await expect(page.getByLabel("Seuil proposé (FCFA)", { exact: true })).toHaveCount(0);

  await page.getByLabel("Dossier sensible", { exact: true }).check();
  await expect(page.getByLabel("Seuil proposé (FCFA)", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Type de client", { exact: true })).toBeVisible();
});

test("un juriste crée un dossier dont la nature dépasse 50 caractères", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers/nouveau");

  const reference = `DOS-E2E-${suffixe()}`;
  await remplirTroncCommun(page, reference, NATURE_LONGUE);
  await page.getByLabel("Dossier de crédit d’origine", { exact: true }).fill("CRD-E2E");
  await page.getByLabel("PV de transfert", { exact: true }).fill("PV-E2E");

  await page.getByRole("button", { name: "Enregistrer" }).click();

  /*
   * Cette nature fait 71 caractères. Avant la migration V7, le backend la refusait en 400 : trois
   * des dix-sept natures de la taxonomie étaient ainsi inutilisables.
   *
   * La création mène à la fiche du dossier créé (écran 07, livré en F7 — levée de QF-22).
   */
  await page.waitForURL(/\/dossiers\/\d+$/, { timeout: 60_000 });
  await expect(page.getByText(reference, { exact: true })).toBeVisible({ timeout: 30_000 });
});

test("une référence de dossier en doublon est signalée sur le champ concerné", async ({ page }) => {
  await seConnecter(page, "juriste.test");

  const reference = `DOS-DUP-${suffixe()}`;

  for (const tentative of [1, 2]) {
    await page.goto("/dossiers/nouveau");
    await remplirTroncCommun(page, reference, NATURE_LONGUE);
    await page.getByLabel("Dossier de crédit d’origine", { exact: true }).fill("CRD-DUP");
    await page.getByLabel("PV de transfert", { exact: true }).fill("PV-DUP");
    await page.getByRole("button", { name: "Enregistrer" }).click();

    if (tentative === 1) {
      await page.waitForURL(/\/dossiers\/\d+$/, { timeout: 60_000 });
    }
  }

  /*
   * `ERR-002` arrive avec `champ: "reference"` depuis la correction Q-70 du backend. Ce parcours
   * vérifie la chaîne complète : le champ nommé par le backend, transporté par `ErreurApi`, posé
   * sur le bon contrôle — et non dans un bandeau au-dessus d'un formulaire de vingt champs.
   */
  const champ = page.getByLabel("Référence", { exact: true });
  await expect(champ).toHaveAttribute("aria-invalid", "true", { timeout: 30_000 });
});

test("la recherche par référence passe par l'URL et reste partageable", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers");

  // Ce filtre n'existait pas côté backend avant M16 (QF-07) : la liste n'était filtrable que par
  // nature, catégorie et juridiction.
  await page.getByLabel("Référence", { exact: true }).fill("DOS-E2E");
  await page.getByLabel("Juridiction", { exact: true }).click();

  await expect(page).toHaveURL(/reference=DOS-E2E/, { timeout: 30_000 });
});

test("le filtre « mes dossiers » ne montre que le portefeuille de l'utilisateur", async ({
  page,
}) => {
  await seConnecter(page, "assistante.test");
  await page.goto("/dossiers?mesDossiers=1");

  /*
   * L'assistante n'est affectée à aucun dossier : le filtre se résolvant sur l'utilisateur
   * authentifié côté backend, elle ne doit rien voir — c'est ce qui garantit qu'il ne permet pas
   * de consulter le portefeuille d'un collègue.
   */
  await expect(page.getByText("Aucun dossier", { exact: true })).toBeVisible({ timeout: 30_000 });
});

test("un avocat n'accède pas aux dossiers", async ({ page }) => {
  await seConnecter(page, "avocat.test");
  await page.goto("/dossiers");

  await expect(
    page.getByRole("heading", { name: "Vous n’avez pas les droits nécessaires" }),
  ).toBeVisible({ timeout: 30_000 });
});

test("les écrans dossiers sont traduits", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "en", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill("juriste.test");
  await page.getByLabel("Password", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });

  await page.goto("/dossiers");
  await expect(page.getByRole("heading", { name: "Cases", level: 1 })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("link", { name: "New case" })).toBeVisible();

  await page.goto("/dossiers/nouveau");
  // L'écran attend **cinq** requêtes avant de sortir de son état de chargement (natures, clients,
  // juristes, avocats, types sensibles) : au premier accès à la route, c'est plus long qu'ailleurs.
  await expect(page.getByRole("heading", { name: "Create a case", level: 1 })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByLabel("Case nature", { exact: true })).toBeVisible();
});
