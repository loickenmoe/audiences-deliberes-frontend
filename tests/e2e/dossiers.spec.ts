import { expect, test, type Page } from "@playwright/test";
import { affecterParDefaut } from "./affectation";
import { deposerPiecesDeCreation } from "./pieces-de-creation";
import { referenceDuDossier } from "./reference-attribuee";
import { choisirAgenceOrigine } from "./agence-de-creation";

/**
 * Case flows (screens 05 and 06) against the real backend. These tests create real cases in the
 * development database.
 */

const MOT_DE_PASSE = "Password1!";

/** A 71-character nature (accepted since migration V7). */
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

/**
 * Fills the common part of the form, excluding conditional documents. The reference is assigned by
 * the system and read after creation with `referenceDuDossier`.
 */
async function remplirTroncCommun(page: Page, nature: string) {
  await page.getByLabel("Nature du dossier", { exact: true }).selectOption(nature);
  await page.getByLabel("Juridiction saisie", { exact: true }).fill("TGI Douala");
  await page.getByLabel("Client", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Risque encouru (FCFA)", { exact: true }).fill("5000000");
  // Mandatory: at least one party on each side.
  await page.getByLabel("Demandeurs 1", { exact: true }).fill("AFRILAND FIRST BANK");
  await page.getByLabel("Défendeurs 1", { exact: true }).fill("Débiteur");
  // Mandatory: the branch comes from the reference data.
  await choisirAgenceOrigine(page);
  await affecterParDefaut(page);
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

  // Debt recovery: original credit file and transfer report. Their files are mandatory, their
  // references are not.
  await expect(page.getByText("Recouvrement", { exact: true }).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByLabel("Dossier de crédit d’origine", { exact: true })).toBeVisible();
  await expect(page.getByLabel("PV de transfert", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Référence de l’incident de compte", { exact: true })).toHaveCount(0);

  // Switching to an operating dispute swaps the two pairs: they are distinct sets, and showing all
  // four would imply they are all required.
  await page.getByLabel("Nature du dossier", { exact: true }).selectOption(NATURE_LITIGE);
  await expect(page.getByLabel("Référence de l’incident de compte", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Éléments justificatifs", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Dossier de crédit d’origine", { exact: true })).toHaveCount(0);
});

test("la sensibilité n'exige seuil et type qu'une fois cochée", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers/nouveau");

  await expect(page.getByLabel("Seuil proposé (FCFA)", { exact: true })).toHaveCount(0);

  await page.getByLabel("Dossier à diligence particulière", { exact: true }).check();
  await expect(page.getByLabel("Seuil proposé (FCFA)", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Type de client", { exact: true })).toBeVisible();
});

/*
 * Attachments are mandatory, not their associated text. Both halves are checked: rejection without
 * a file, and acceptance without a reference.
 */
test("les pièces sont obligatoires, leurs références ne le sont plus", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers/nouveau");

  await remplirTroncCommun(page, NATURE_LONGUE);

  // Neither files nor references: the screen must reject and name the missing document.
  await page.getByRole("button", { name: "Enregistrer" }).click();

  await expect(
    page.getByText("Cette pièce est obligatoire : joignez son fichier.").first(),
  ).toBeVisible({ timeout: 30_000 });
  // Nothing was created: still on the form.
  await expect(page).toHaveURL(/\/dossiers\/nouveau/);

  // Files alone are enough: references stay empty.
  await deposerPiecesDeCreation(page, { marque: "sans-references" });
  await page.getByRole("button", { name: "Enregistrer" }).click();

  await page.waitForURL(/\/dossiers\/\d+$/, { timeout: 60_000 });
  // The reference is assigned: check its format.
  expect(await referenceDuDossier(page)).toMatch(/^DOS-\d{4}-\d{4,}$/);
});

test("un juriste crée un dossier dont la nature dépasse 50 caractères", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers/nouveau");

  await remplirTroncCommun(page, NATURE_LONGUE);
  await page.getByLabel("Dossier de crédit d’origine", { exact: true }).fill("CRD-E2E");
  await page.getByLabel("PV de transfert", { exact: true }).fill("PV-E2E");
  await deposerPiecesDeCreation(page, { marque: "dos" });

  await page.getByRole("button", { name: "Enregistrer" }).click();

  /*
   * This nature has 71 characters (accepted since migration V7).
   * Creation leads to the created case page (screen 07).
   */
  await page.waitForURL(/\/dossiers\/\d+$/, { timeout: 60_000 });
  // The reference is assigned: check its format.
  expect(await referenceDuDossier(page)).toMatch(/^DOS-\d{4}-\d{4,}$/);
});

/*
 * The system assigns references: two cases created in a row never share a number, and the second
 * follows the first. Uniqueness itself is proven in the database by GenerateurReferenceIntegrationTest.
 */
test("deux dossiers créés à la suite reçoivent deux références distinctes", async ({ page }) => {
  await seConnecter(page, "juriste.test");

  const references: string[] = [];
  for (const rang of [1, 2]) {
    await page.goto("/dossiers/nouveau");
    await remplirTroncCommun(page, NATURE_LONGUE);
    await deposerPiecesDeCreation(page, { marque: `suite-${rang}` });
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\/dossiers\/\d+$/, { timeout: 60_000 });
    references.push(await referenceDuDossier(page));
  }

  expect(references[0]).not.toEqual(references[1]);

  // They are consecutive: the counter moves by one, never skips or goes back.
  const numero = (reference: string) => Number(reference.split("-")[2]);
  expect(numero(references[1])).toEqual(numero(references[0]) + 1);
});

/**
 * Search by reference as you type. The key assertion is that the field keeps focus: the filter
 * applies without leaving it.
 */
test("la recherche par référence s'applique sans quitter le champ, et reste partageable", async ({
  page,
}) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers");

  const champ = page.getByLabel("Référence", { exact: true });
  await champ.fill("DOS-E2E");

  // Nothing else is touched: no click elsewhere, no Enter key.
  await expect(page).toHaveURL(/reference=DOS-E2E/, { timeout: 30_000 });
  await expect(champ, "le filtre a exigé de quitter le champ").toBeFocused();
  await expect(champ).toHaveValue("DOS-E2E");
});

test("la recherche par juridiction s'applique aussi au fil de la frappe", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers");

  const champ = page.getByLabel("Juridiction", { exact: true });
  await champ.fill("TPI");

  await expect(page).toHaveURL(/juridiction=TPI/, { timeout: 30_000 });
  await expect(champ, "le filtre a exigé de quitter le champ").toBeFocused();
});

/**
 * Search-as-you-type changes the list without explicit action: a polite live region announces the
 * result count, otherwise it would change silently for screen reader users.
 */
test("le nombre de résultats est annoncé quand le filtre agit tout seul", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers");

  const annonce = page.getByRole("status").filter({ hasText: /élément/ });
  await expect(annonce).toBeAttached({ timeout: 30_000 });

  await page.getByLabel("Référence", { exact: true }).fill("ZZZ-INEXISTANT");
  await expect(page).toHaveURL(/reference=ZZZ-INEXISTANT/, { timeout: 30_000 });
  // "No results" is announced rather than leaving an empty table.
  await expect(annonce).toHaveText(/Aucun élément/, { timeout: 30_000 });
});

/**
 * Search-as-you-type sends one request per pause, not per character: a word typed in one go leaves
 * a single URL update. The delay itself is unit-tested.
 */
test("un mot tapé d'un trait ne produit qu'une écriture d'URL", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers");

  const champ = page.getByLabel("Référence", { exact: true });
  await champ.click();
  // `pressSequentially` types letter by letter, unlike `fill`.
  await champ.pressSequentially("DOS-2026", { delay: 30 });

  await expect(page).toHaveURL(/reference=DOS-2026/, { timeout: 30_000 });
  /*
   * Filters are written with `router.replace`, which pushes nothing: going back must leave the
   * list, not walk through the intermediate states.
   */
  await page.goBack();
  await expect(page).not.toHaveURL(/reference=DOS-202/, { timeout: 30_000 });
});

test("le filtre « mes dossiers » ne montre que le portefeuille de l'utilisateur", async ({
  page,
}) => {
  await seConnecter(page, "assistante.test");
  await page.goto("/dossiers?mesDossiers=1");

  /*
   * The assistant is assigned to no case. The filter resolves on the authenticated user backend-side,
   * so she must see nothing: it cannot be used to view a colleague's portfolio.
   */
  await expect(page.getByText("Aucun dossier", { exact: true })).toBeVisible({ timeout: 30_000 });
});

/*
 * Filter by step and hearing period, and sort. Checks the screen -> URL -> request chain without
 * depending on the data set; the results are checked by `DossierFiltresIntegrationTest`.
 */
test("les filtres d'étape et de tri passent par l'URL et restent partageables", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers");

  await page.getByLabel("Étape", { exact: true }).selectOption("RECOURS_1");
  await page.getByLabel("Statut de l'étape", { exact: true }).selectOption("EN_COURS");

  await expect(page).toHaveURL(/typeEtape=RECOURS_1/, { timeout: 30_000 });
  await expect(page).toHaveURL(/statutEtape=EN_COURS/, { timeout: 30_000 });

  await page.getByLabel("Trier par", { exact: true }).selectOption("REFERENCE");
  await expect(page).toHaveURL(/tri=REFERENCE/, { timeout: 30_000 });

  // `RECENT` is the server default: selecting it again must remove the parameter, not write it.
  await page.getByLabel("Trier par", { exact: true }).selectOption("");
  await expect(page).not.toHaveURL(/tri=/, { timeout: 30_000 });
});

test("la période porte sur les audiences et reste dans l'URL", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers");

  await page.getByLabel("Audience du", { exact: true }).fill("2026-03-01");
  await page.getByLabel("Audience au", { exact: true }).fill("2026-03-31");

  await expect(page).toHaveURL(/dateDebut=2026-03-01/, { timeout: 30_000 });
  await expect(page).toHaveURL(/dateFin=2026-03-31/, { timeout: 30_000 });
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
  // The screen waits for five requests before leaving its loading state (natures, clients, legal
  // officers, lawyers, sensitive types): the first visit takes longer.
  await expect(page.getByRole("heading", { name: "Create a case", level: 1 })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByLabel("Case nature", { exact: true })).toBeVisible();
});

/**
 * Guard against losing form input. What matters is the input itself: after cancelling the
 * navigation, the fields must still be filled.
 */
test("une saisie de dossier en cours ne se perd pas sur un clic de menu", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers/nouveau");

  const juridiction = `TGI GARDE ${suffixe()}`;
  await page.getByLabel("Juridiction saisie", { exact: true }).fill(juridiction);

  // A click on the navigation: the guard must step in.
  await page.getByRole("navigation").getByRole("link", { name: "Clients" }).click();
  const dialogue = page.getByRole("dialog", { name: "Quitter sans enregistrer ?" });
  await expect(dialogue).toBeVisible({ timeout: 10_000 });

  // Cancel: stay on the form with input intact.
  await dialogue.getByRole("button", { name: "Annuler" }).click();
  await expect(page).toHaveURL(/\/dossiers\/nouveau/);
  await expect(page.getByLabel("Juridiction saisie", { exact: true })).toHaveValue(juridiction);

  // Confirm: leave for good.
  await page.getByRole("navigation").getByRole("link", { name: "Clients" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Quitter sans enregistrer" }).click();
  await page.waitForURL(/\/clients/, { timeout: 30_000 });
});

/** The form's "Annuler" is an explicit intent: it must not be double-confirmed. */
test("l'Annuler du formulaire n'est pas intercepté par la garde", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers/nouveau");
  await page.getByLabel("Juridiction saisie", { exact: true }).fill(`TGI GARDE ${suffixe()}`);

  await page.getByRole("link", { name: "Annuler" }).click();
  await page.waitForURL(/\/dossiers$/, { timeout: 30_000 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

/** Without input, the guard stays silent. */
test("un formulaire vierge se quitte sans confirmation", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers/nouveau");

  await page.getByRole("navigation").getByRole("link", { name: "Clients" }).click();
  await page.waitForURL(/\/clients/, { timeout: 30_000 });
});

/**
 * The language switch is a server action that sets a cookie and revalidates the shell; neither the
 * guard nor `beforeunload` intercept it. Input survives only because the refresh reconciles the
 * tree instead of remounting it: a `redirect()` added to `changerLangue` would silently clear the form.
 */
test("changer de langue ne vide pas un formulaire en cours de saisie", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers/nouveau");

  const juridiction = `TGI LANGUE ${suffixe()}`;
  await page.getByLabel("Juridiction saisie", { exact: true }).fill(juridiction);

  await page.getByRole("button", { name: "en", exact: true }).click();
  await expect(page.getByLabel("Court seized", { exact: true }))
    .toHaveValue(juridiction, { timeout: 30_000 });
});

/**
 * Ten rows per page: page 2 must show different references from page 1, so a table losing rows
 * beyond the tenth would fail.
 */
test("un tableau montre dix lignes, et la suite est sur la page suivante", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers");

  const lignes = page.getByRole("main").getByRole("row");
  await expect(lignes.nth(1)).toBeVisible({ timeout: 30_000 });

  // The header counts as a row: ten data rows make eleven in total.
  const nbPage1 = await lignes.count();
  if (nbPage1 <= 2) return; // data set too small to observe the rule

  expect(nbPage1).toBeLessThanOrEqual(11);
  const referencesPage1 = await lignes.nth(1).innerText();

  const suivant = page.getByRole("button", { name: "Page suivante" });
  if (await suivant.isDisabled()) return; // single page: nothing to compare

  await suivant.click();
  await expect(page).toHaveURL(/page=1/);

  // `not.toHaveText` retries until the row changes; reading right after the click would still see
  // the previous page.
  await expect(page.getByRole("main").getByRole("row").nth(1)).not.toHaveText(referencesPage1, {
    timeout: 30_000,
  });
});

/** Page size selector: ten to read, fifty to scan. */
test("le sélecteur de taille change le nombre de lignes et vit dans l'URL", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers");
  await expect(page.getByRole("main").getByRole("row").nth(1)).toBeVisible({ timeout: 30_000 });

  await page.getByLabel("Lignes par page").selectOption("50");
  await expect(page).toHaveURL(/taille=50/);

  // A shared link must reopen the list as its author saw it.
  await page.reload();
  await expect(page.getByLabel("Lignes par page")).toHaveValue("50");
});

/**
 * Explanatory placeholders in the creation form (N5): the hint goes inside the field.
 * The searchable select's accessible name is the label alone, without the required asterisk.
 */
test("les champs du formulaire de création portent leurs placeholders explicatifs", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers/nouveau");

  // Searchable select: its accessible name is the label only, without the asterisk.
  const agence = page.getByRole("combobox", { name: "Agence d’origine" });
  await expect(agence).toBeVisible({ timeout: 30_000 });
  await expect(agence).toHaveAttribute("aria-required", "true");
  await expect(agence).toHaveAttribute("placeholder", "Code, nom ou ville de l’agence…");

  // Free fields: the hint is inside the field and disappears when typing.
  await expect(page.getByLabel("Juridiction saisie", { exact: true })).toHaveAttribute(
    "placeholder",
    "Le tribunal devant lequel l’affaire est portée",
  );
  await expect(page.getByLabel("Risque encouru (FCFA)", { exact: true })).toHaveAttribute(
    "placeholder",
    "Ce que la banque peut perdre",
  );

  // A party: every row in the list has the same one.
  await expect(page.getByPlaceholder("Qui engage l’action")).toBeVisible();
  await expect(page.getByPlaceholder("Contre qui l’action est engagée")).toBeVisible();

  // Document references restate the rule most often reversed: the file is required, not the reference.
  await page.getByLabel("Nature du dossier", { exact: true }).selectOption(NATURE_LONGUE);
  await expect(
    page.getByLabel("Dossier de crédit d’origine", { exact: true }),
  ).toHaveAttribute("placeholder", "Référence facultative : c’est le fichier qui est exigé");
});
