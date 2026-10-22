import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Automated WCAG 2.1 AA audit (axe) of the rendered, authenticated screens with real data.
 * Complements `tests/unit/contraste.test.ts`, which only checks the declared color tokens.
 * No violation is tolerated: a rule may only be excluded explicitly, with its reason.
 */

const MOT_DE_PASSE = "Password1!";

/** WCAG 2.0 and 2.1, levels A and AA. AAA is out of scope. */
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
  // Name the rule and the elements in the failure message; "1 violation" alone is useless.
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

/** The lawyer portal is the only one open to external users. */
test("les écrans du portail avocat sont accessibles", async ({ page }) => {
  await seConnecter(page, "avocat.test");

  for (const chemin of ["/", "/portail", "/frais/nouvelle", "/publications/nouvelle"]) {
    await page.goto(chemin);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
    await auditer(page);
  }
});

/** A dialog must have an accessible name, otherwise a screen reader only announces "dialog". */
test("une boîte de dialogue ouverte reste accessible", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/clients");
  await page.getByRole("button", { name: "Nouveau client" }).click();

  const dialogue = page.getByRole("dialog");
  await expect(dialogue).toBeVisible();
  // Check the computed name, not an attribute: the dialog gets it from `aria-labelledby`.
  await expect(dialogue).toHaveAccessibleName(/.+/);
  await auditer(page);
});

test("la navigation au clavier atteint le contenu sans piège", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers");

  // After ten tabs from the top, focus must still be inside the page and visible.
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
