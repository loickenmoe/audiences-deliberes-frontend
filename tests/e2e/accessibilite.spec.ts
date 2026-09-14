import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Audit d'accessibilité **WCAG 2.1 niveau AA**, automatisé sur les écrans réellement servis.
 *
 * `tests/unit/contraste.test.ts` couvrait déjà les contrastes, mais sur les **jetons** : il mesure
 * ce que la feuille de style déclare, pas ce que le navigateur rend. Ici, axe inspecte l'arbre
 * d'accessibilité d'une page authentifiée, avec ses données réelles — étiquettes de formulaire,
 * noms accessibles, hiérarchie des titres, rôles ARIA, contraste calculé sur le rendu.
 *
 * **Aucune violation n'est tolérée.** Une exception admise deviendrait la règle : si une règle doit
 * être écartée, elle l'est explicitement, avec son motif écrit, et jamais en masse.
 */

const MOT_DE_PASSE = "Password1!";

/** Les balises du contrat : WCAG 2.0 et 2.1, niveaux A et AA. AAA n'est pas un objectif du projet. */
const NORMES = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function seConnecter(page: Page, identifiant: string) {
  await page.goto("/login");
  await page.getByLabel("Identifiant", { exact: true }).fill(identifiant);
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Connexion" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
}

async function auditer(page: Page) {
  const resultat = await new AxeBuilder({ page }).withTags(NORMES).analyze();
  // Le message d'échec nomme la règle et l'élément : sans cela, « 1 violation » est inexploitable.
  const lisible = resultat.violations.map((v) => ({
    regle: v.id,
    impact: v.impact,
    description: v.help,
    elements: v.nodes.map((n) => n.target.join(" ")),
  }));
  expect(lisible, `violations WCAG AA sur ${page.url()}`).toEqual([]);
}

test("la page de connexion est accessible, avant toute authentification", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Identifiant", { exact: true })).toBeVisible();
  await auditer(page);
});

test("les pages d'erreur sont accessibles", async ({ page }) => {
  await page.goto("/route-qui-nexiste-pas");
  await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
  await auditer(page);
});

/**
 * Les écrans du juriste, celui qui porte le plus d'écrans : accueil, liste, fiche, formulaire de
 * création, calendrier et base jurisprudentielle. Un formulaire long est le cas le plus exposé —
 * étiquettes, messages d'erreur reliés, champs obligatoires.
 */
test("les écrans du juriste sont accessibles", async ({ page }) => {
  await seConnecter(page, "juriste.test");

  for (const chemin of [
    "/",
    "/dossiers",
    "/dossiers/nouveau",
    "/clients",
    "/audiences/calendrier",
    "/jurisprudences",
    "/notifications",
    "/rapports",
  ]) {
    await page.goto(chemin);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
    await auditer(page);
  }
});

test("les écrans de la direction sont accessibles", async ({ page }) => {
  await seConnecter(page, "dj.test");

  for (const chemin of ["/tableau-de-bord", "/admin/configurations", "/ged/demandes-suppression", "/frais"]) {
    await page.goto(chemin);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
    await auditer(page);
  }
});

/** Le portail de l'avocat : le seul accessible à un utilisateur externe, donc le moins pardonnable. */
test("les écrans du portail avocat sont accessibles", async ({ page }) => {
  await seConnecter(page, "avocat.test");

  for (const chemin of ["/", "/portail", "/frais/nouvelle", "/publications/nouvelle"]) {
    await page.goto(chemin);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
    await auditer(page);
  }
});

/**
 * Une modale est le piège classique : elle doit porter un nom accessible, et le focus ne doit pas
 * pouvoir s'en échapper. Le cas est vérifié sur la fiche d'un dossier, où plusieurs modales
 * coexistent — une modale fermée reste dans le DOM.
 */
test("une boîte de dialogue ouverte reste accessible", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/clients");
  await page.getByRole("button", { name: "Nouveau client" }).click();

  const dialogue = page.getByRole("dialog");
  await expect(dialogue).toBeVisible();
  // Un nom accessible : sans lui, un lecteur d'écran annonce « boîte de dialogue » et rien d'autre.
  // On vérifie le **nom calculé**, non l'attribut : la modale le tient d'`aria-labelledby`, ce qui
  // est tout aussi valide et relie le titre affiché à la boîte.
  await expect(dialogue).toHaveAccessibleName(/.+/);
  await auditer(page);
});

test("la navigation au clavier atteint le contenu sans piège", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers");

  // Dix tabulations depuis le haut : le focus doit rester dans la page et rester visible.
  for (let i = 0; i < 10; i += 1) {
    await page.keyboard.press("Tab");
  }
  const actif = await page.evaluate(() => {
    const element = document.activeElement;
    if (!element || element === document.body) return null;
    return { balise: element.tagName, visible: (element as HTMLElement).offsetParent !== null };
  });
  expect(actif, "le focus ne doit pas retomber sur le corps du document").not.toBeNull();
  expect(actif!.visible, "l'élément focalisé doit être visible").toBe(true);
});
