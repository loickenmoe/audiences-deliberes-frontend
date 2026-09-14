import { expect, test, type Page } from "@playwright/test";

/**
 * Comportement responsive aux **trois points de rupture** du design system.
 *
 * Ce qui est vérifié n'est pas l'esthétique — un test ne sait pas si une page est belle — mais deux
 * propriétés objectives, et les seules qui rendent une interface inutilisable quand elles cèdent :
 *
 * 1. **Aucun débordement horizontal.** Une page plus large que la fenêtre force un défilement
 *    latéral sur tout le document : les tableaux denses de ce projet en sont la cause classique.
 *    `TableDonnees` les enferme dans un conteneur à défilement propre — c'est ce qu'on contrôle.
 * 2. **Le contenu et la navigation restent atteignables** à chaque largeur.
 */

const MOT_DE_PASSE = "Password1!";

/**
 * Les trois largeurs des points de rupture Tailwind utilisés par le projet : `sm` (640), `lg`
 * (1024) et `xl` (1280). 375 px représente le mobile réel, en deçà du premier point de rupture.
 */
const LARGEURS = [
  { nom: "mobile", largeur: 375, hauteur: 812 },
  { nom: "tablette", largeur: 768, hauteur: 1024 },
  { nom: "bureau", largeur: 1280, hauteur: 800 },
] as const;

/** Les écrans les plus exposés : tableaux denses, formulaire long, grille d'indicateurs. */
const ECRANS = ["/", "/dossiers", "/dossiers/nouveau", "/frais", "/notifications", "/tableau-de-bord"];

async function seConnecter(page: Page, identifiant: string) {
  await page.goto("/login");
  await page.getByLabel("Identifiant", { exact: true }).fill(identifiant);
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Connexion" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
}

/**
 * Le document déborde-t-il de la fenêtre ? On compare la largeur de défilement du document à celle
 * de la fenêtre, avec une tolérance d'un pixel : les arrondis de mise en page en produisent un.
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
  // Un lien de la navigation doit rester cliquable : masqué ou hors écran, le profil est bloqué.
  await navigation.getByRole("link", { name: "Dossiers" }).click();
  await page.waitForURL(/\/dossiers/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

/**
 * Un tableau dense défile **dans son propre conteneur**, jamais en emportant la page. C'est la
 * règle posée par `TableDonnees` ; sans elle, lire la dernière colonne décalerait l'en-tête et la
 * navigation hors de l'écran.
 */
test("un tableau dense défile dans son conteneur, pas dans la page", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await seConnecter(page, "dj.test");
  await page.goto("/frais");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });

  const tableau = page.getByRole("table").first();
  if ((await tableau.count()) === 0) return; // file vide : rien à mesurer, l'état vide s'affiche

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
