import { expect, test, type Page } from "@playwright/test";

/**
 * Branch reference data (screen 44). Rules covered: the code cannot be modified, a branch is
 * closed and reopened instead of deleted, and the city is mandatory (two branches may share a name).
 *
 * The list is paginated (25 per page, sorted by code), so a new branch must be searched for.
 * Branches cannot be deleted: each one created here is left closed so other tests never pick it.
 */
const MOT_DE_PASSE = "Password1!";

async function seConnecter(page: Page, identifiant: string) {
  await page.goto("/login");
  await page.getByLabel("Identifiant", { exact: true }).fill(identifiant);
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Connexion" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
}

/**
 * A code outside any real range, unique across runs (branches are never deleted, so every run
 * leaves its own behind). A millisecond timestamp fits the 20-character column.
 */
function codeDeTest() {
  return `9${Date.now() % 1_000_000_000}`;
}

function ligne(page: Page, code: string) {
  return page.getByRole("row").filter({ has: page.getByRole("cell", { name: code, exact: true }) });
}

/** Server-side search: finds the branch whatever page its code puts it on. */
async function chercher(page: Page, code: string) {
  await page.getByLabel("Rechercher une agence", { exact: true }).fill(code);
  await expect(ligne(page, code)).toBeVisible({ timeout: 30_000 });
}

/**
 * Closes the branch from its row, including confirmation. The dialog button has the same label as
 * the row button, so it must be targeted inside the dialog.
 */
async function fermerDepuisLaLigne(page: Page, code: string) {
  await ligne(page, code).getByRole("button", { name: /Désactiver/ }).click();
  const dialogue = page.getByRole("dialog");
  await dialogue.getByRole("button", { name: "Désactiver", exact: true }).click();
  await expect(dialogue).toBeHidden({ timeout: 30_000 });
  await expect(ligne(page, code).getByText("Fermée")).toBeVisible({ timeout: 30_000 });
}

async function creerAgence(page: Page, nom: string) {
  const code = codeDeTest();
  await page.goto("/admin/agences");
  await page.getByRole("button", { name: "Nouvelle agence" }).click();
  await page.getByLabel("Code", { exact: true }).fill(code);
  await page.getByLabel("Nom", { exact: true }).fill(nom);
  await page.getByLabel("Ville", { exact: true }).fill("Douala");
  await page.getByLabel("Adresse", { exact: true }).fill("Rue de la recette");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  // Wait for the dialog to close: a modal `<dialog>` makes the rest of the page inert, so an
  // earlier search would be ignored.
  await expect(page.getByRole("dialog", { name: "Créer une agence" })).toBeHidden({ timeout: 30_000 });
  await chercher(page, code);
  return code;
}

test("le DJ crée une agence, que la saisie propose aussitôt", async ({ page }) => {
  await seConnecter(page, "dj.test");
  const nom = `AGENCE E2E ${Date.now() % 100000}`;
  const code = await creerAgence(page, nom);

  await expect(ligne(page, code).getByText("Ouverte")).toBeVisible();

  // Case creation must offer it immediately: same reference data.
  await page.goto("/dossiers/nouveau");
  const champ = page.getByRole("combobox", { name: /Agence d.origine/ });
  await champ.click();
  await champ.fill(code);
  const liste = page.getByRole("listbox", { name: /Agence d.origine/ });
  // The option shows the code, the word "Agence" and the city.
  await expect(liste.getByRole("option", { name: new RegExp(`${code} · Agence ${nom} · Douala`) }))
    .toBeVisible({ timeout: 30_000 });

  // Leave it closed so it does not show up in other tests.
  await page.goto("/admin/agences");
  await chercher(page, code);
  await fermerDepuisLaLigne(page, code);
});

test("la ville est obligatoire, et un code déjà porté est refusé", async ({ page }) => {
  await seConnecter(page, "dj.test");
  await page.goto("/admin/agences");
  await page.getByRole("button", { name: "Nouvelle agence" }).click();

  await page.getByLabel("Code", { exact: true }).fill(codeDeTest());
  await page.getByLabel("Nom", { exact: true }).fill("SANS VILLE");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Ce champ est obligatoire.").first()).toBeVisible();

  // `00002` is Bonanjo, loaded by migration V42: the duplicate is reported on the Code field.
  await page.getByLabel("Code", { exact: true }).fill("00002");
  await page.getByLabel("Ville", { exact: true }).fill("Douala");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText(/porte déjà le code 00002/)).toBeVisible({ timeout: 30_000 });
});

test("une agence se ferme puis se rouvre, et garde son code", async ({ page }) => {
  await seConnecter(page, "dj.test");
  const nom = `AGENCE CYCLE ${Date.now() % 100000}`;
  const code = await creerAgence(page, nom);

  await fermerDepuisLaLigne(page, code);

  // Once closed, it is no longer offered...
  await page.goto("/dossiers/nouveau");
  const champ = page.getByRole("combobox", { name: /Agence d.origine/ });
  await champ.click();
  await champ.fill(code);
  const liste = page.getByRole("listbox", { name: /Agence d.origine/ });
  await expect(liste.getByText("Aucun résultat")).toBeVisible({ timeout: 30_000 });

  // ...but it can be reopened without confirmation.
  await page.goto("/admin/agences");
  await chercher(page, code);
  await ligne(page, code).getByRole("button", { name: /Réactiver/ }).click();
  await expect(ligne(page, code).getByText("Ouverte")).toBeVisible({ timeout: 30_000 });
  await expect(ligne(page, code).getByRole("cell", { name: code, exact: true })).toBeVisible();

  await fermerDepuisLaLigne(page, code);
});

test("le code d'une agence ne se modifie pas", async ({ page }) => {
  await seConnecter(page, "dj.test");
  const code = await creerAgence(page, `AGENCE CODE ${Date.now() % 100000}`);

  await ligne(page, code).getByRole("button", { name: /Modifier/ }).click();
  // Target inside the dialog: the closed creation `<dialog>` stays in the DOM with its own "Code" field.
  const modale = page.getByRole("dialog", { name: "Modifier l’agence" });
  // Cases store the code as is: changing it would detach them from their branch.
  await expect(modale.getByLabel("Code", { exact: true })).toBeDisabled();
  await expect(modale.getByText(/ne se modifie pas/).first()).toBeVisible();

  await modale.getByLabel("Ville", { exact: true }).fill("Yaoundé");
  await modale.getByRole("button", { name: "Enregistrer" }).click();
  await expect(modale).toBeHidden({ timeout: 30_000 });
  await expect(ligne(page, code).getByRole("cell", { name: "Yaoundé", exact: true }))
    .toBeVisible({ timeout: 30_000 });

  await fermerDepuisLaLigne(page, code);
});

test("la recherche porte sur le code et sur le nom, sans distinction de casse", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/admin/agences");

  await page.getByLabel("Rechercher une agence", { exact: true }).fill("bona");
  // Four V42 branches start with "BONA": a lowercase fragment matches uppercase names.
  await expect(page.getByRole("cell", { name: "BONANJO", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("cell", { name: "BONAPRISO", exact: true })).toBeVisible();

  await page.getByLabel("Rechercher une agence", { exact: true }).fill("00002");
  await expect(page.getByRole("cell", { name: "BONANJO", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("cell", { name: "BONAPRISO", exact: true })).toHaveCount(0);
});

test("un juriste lit le référentiel des agences mais ne l'écrit pas", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/admin/agences");

  await expect(page.getByRole("heading", { name: "Agences", level: 1 })).toBeVisible();
  // Read-only: maintenance belongs to the DJ and the DJA.
  await expect(page.getByRole("button", { name: "Nouvelle agence" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Modifier/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Désactiver/ })).toHaveCount(0);
});

test("l'écran des agences est traduit", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "en", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill("dj.test");
  await page.getByLabel("Password", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });

  await page.goto("/admin/agences");
  await expect(page.getByRole("heading", { name: "Branches", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "New branch" })).toBeVisible();
  await expect(page.getByLabel("Search for a branch", { exact: true })).toBeVisible();

  // The word preceding the name is translated too.
  await page.goto("/dossiers/nouveau");
  const champ = page.getByRole("combobox", { name: /Originating branch/ });
  await champ.click();
  await champ.fill("00002");
  const liste = page.getByRole("listbox", { name: /Originating branch/ });
  await expect(liste.getByRole("option", { name: /00002 · Branch BONANJO · Douala/ }))
    .toBeVisible({ timeout: 30_000 });
});
