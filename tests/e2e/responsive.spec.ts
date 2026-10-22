import { expect, test, type Page } from "@playwright/test";

/**
 * Responsive behaviour at the design system breakpoints. Checks two objective properties:
 * 1. No horizontal overflow: dense tables must scroll inside `TableDonnees`, not the page.
 * 2. Content and navigation remain reachable at every width.
 */

const MOT_DE_PASSE = "Password1!";

/**
 * Tailwind breakpoints used by the project: `sm` (640), `lg` (1024) and `xl` (1280). 375 px is a
 * real mobile, below the first breakpoint.
 */
const LARGEURS = [
  { nom: "mobile", largeur: 375, hauteur: 812 },
  { nom: "tablette", largeur: 768, hauteur: 1024 },
  { nom: "bureau", largeur: 1280, hauteur: 800 },
] as const;

/** The most exposed screens: dense tables, long form, indicator grid. */
const ECRANS = ["/", "/dossiers", "/dossiers/nouveau", "/frais", "/notifications", "/tableau-de-bord"];

async function seConnecter(page: Page, identifiant: string) {
  await page.goto("/login");
  await page.getByLabel("Identifiant", { exact: true }).fill(identifiant);
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Connexion" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
}

/**
 * Whether the document overflows the window: compares scroll width to window width, with a
 * one-pixel tolerance for layout rounding.
 */
async function debordementHorizontal(page: Page): Promise<number> {
  return page.evaluate(() => {
    const document_ = document.documentElement;
    return Math.max(0, document_.scrollWidth - document_.clientWidth - 1);
  });
}

for (const { nom, largeur, hauteur } of LARGEURS) {
  test(`aucun débordement horizontal en ${nom} (${largeur} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: hauteur });
    await seConnecter(page, "dj.test");

    for (const chemin of ECRANS) {
      await page.goto(chemin);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
      const debordement = await debordementHorizontal(page);
      expect(debordement, `${chemin} déborde de ${debordement} px en ${nom}`).toBe(0);
    }
  });
}

test("la navigation principale reste atteignable sur mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await seConnecter(page, "juriste.test");

  const navigation = page.getByRole("navigation", { name: "Navigation principale" });
  await expect(navigation).toBeVisible();
  // A navigation link must remain clickable; hidden or off-screen, the profile is stuck.
  await navigation.getByRole("link", { name: "Dossiers" }).click();
  await page.waitForURL(/\/dossiers/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

/**
 * A dense table scrolls inside its own container, never dragging the page (`TableDonnees` rule);
 * otherwise reading the last column would push the header and navigation off-screen.
 */
test("un tableau dense défile dans son conteneur, pas dans la page", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await seConnecter(page, "dj.test");
  await page.goto("/frais");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });

  const tableau = page.getByRole("table").first();
  if ((await tableau.count()) === 0) return; // empty queue: nothing to measure

  const conteneurDefile = await tableau.evaluate((element) => {
    let parent = element.parentElement;
    while (parent) {
      const debordement = getComputedStyle(parent).overflowX;
      if (debordement === "auto" || debordement === "scroll") return true;
      parent = parent.parentElement;
    }
    return false;
  });
  expect(conteneurDefile, "le tableau doit être enfermé dans un conteneur à défilement").toBe(true);
  expect(await debordementHorizontal(page)).toBe(0);
});

/**
 * Application shell: on large screens the header and sidebar stay in place and only the content
 * scrolls, keeping the notification bell (NF-ALR-02) and logout always reachable.
 */
test("sur grand écran, l'en-tête et la navigation ne défilent pas avec le contenu", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });

  const entete = page.getByRole("banner");
  const navigation = page.getByRole("navigation", { name: "Navigation principale" });
  const avantEntete = await entete.boundingBox();
  const avantNavigation = await navigation.boundingBox();

  await page.locator("#contenu-principal").evaluate((element) => element.scrollBy(0, 600));
  await page.waitForTimeout(400);

  expect((await entete.boundingBox())?.y).toBe(avantEntete?.y);
  expect((await navigation.boundingBox())?.y).toBe(avantNavigation?.y);
  // The bell is reachable without scrolling back up. Targets the header one: the sidebar has a link
  // with the same name.
  await expect(entete.getByRole("link", { name: /Notifications/ })).toBeVisible();
});

/**
 * Mobile deliberately keeps page scrolling: header and navigation strip take 117 px of 667 (18 %).
 * The navigation is a scrolling strip to save that height; this test prevents undoing it.
 */
test("sur mobile, la page défile en entier — l'espace vertical prime", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });

  const entete = page.getByRole("banner");
  const avant = await entete.boundingBox();
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(400);

  const defilement = await page.evaluate(() => window.scrollY);
  if (defilement === 0) return; // page too short to scroll: nothing to observe
  expect((await entete.boundingBox())?.y).toBeLessThan(avant?.y ?? 0);
});

/**
 * The content is the scroll container, so Next no longer resets it (it only knows the window).
 * Without an explicit reset, a screen would open at the previous screen's scroll position.
 */
test("changer d'écran ramène le contenu en haut", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });

  await page.locator("#contenu-principal").evaluate((element) => element.scrollBy(0, 400));
  await page.waitForTimeout(300);

  await page.getByRole("navigation").getByRole("link", { name: "Clients" }).click();
  await page.waitForURL(/\/clients/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });

  await expect
    .poll(() => page.locator("#contenu-principal").evaluate((element) => element.scrollTop))
    .toBe(0);
});

/**
 * The logo links to the home page. It is only shown from `lg`; below that, home is reached through
 * the "Accueil" entry of the navigation strip. The accessible name is checked along with the target.
 */
test("sur grand écran, le logo de l'en-tête ramène à l'accueil", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seConnecter(page, "juriste.test");

  await page.goto("/dossiers");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });

  const logo = page.getByRole("link", { name: /Afriland First Bank/ });
  await expect(logo).toBeVisible();
  await logo.click();

  await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
});

test("sur mobile, le logo n'est pas affiché et l'accueil reste atteignable par la navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await seConnecter(page, "juriste.test");

  await page.goto("/dossiers");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: /Afriland First Bank/ })).toHaveCount(0);

  // `exact`: above `lg` the logo is a second home link in this landmark. The selector must not
  // depend on screen width to stay unambiguous.
  await page.getByRole("navigation").getByRole("link", { name: "Accueil", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
});
