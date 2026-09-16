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

/**
 * QF-47 — la coquille d'application : sur grand écran, l'en-tête et la barre latérale restent en
 * place, seul le contenu défile.
 *
 * Ce que la correction protège : la **cloche de notifications** — canal obligatoire des alertes
 * (NF-ALR-02) — et la **déconnexion**, que le guide §1 réclame en poste partagé. Les perdre en
 * défilant une fiche de dossier, c'est perdre le seul dispositif qui signale une échéance et le seul
 * qui ferme la session.
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
  // La cloche reste atteignable sans remonter : c'est l'objet de la correction. On vise celle de
  // l'en-tête — la barre latérale porte un lien du même nom.
  await expect(entete.getByRole("link", { name: /Notifications/ })).toBeVisible();
});

/**
 * Le mobile garde son défilement de page **délibérément** : en-tête et bande de navigation pèsent
 * 117 px sur 667, soit 18 % de la hauteur. F17 a transformé la navigation en bande défilante pour
 * récupérer cette hauteur ; ce test empêche de défaire ce choix par inadvertance.
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
  if (defilement === 0) return; // page trop courte pour défiler : rien à observer
  expect((await entete.boundingBox())?.y).toBeLessThan(avant?.y ?? 0);
});

/**
 * Le contenu étant devenu le conteneur de défilement, Next ne le remet plus à zéro lui-même —
 * il ne connaît que la fenêtre. Sans ce geste, un écran s'ouvrirait « au milieu », à la hauteur où
 * l'on avait laissé le précédent.
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
 * QF-49 — le logo rejoint l'accueil.
 *
 * Il n'est affiché qu'à partir de `lg` : en dessous, le bandeau qui le porte est masqué et le retour
 * à l'accueil passe par l'entrée « Accueil » de la bande de navigation. Les deux moitiés sont
 * vérifiées, pour qu'on ne « corrige » pas plus tard le mobile en croyant à un oubli.
 *
 * Le nom accessible est contrôlé en même temps que la destination : un lien dont le lecteur d'écran
 * annonce « Afriland First Bank » dit à qui appartient l'image, pas où il mène.
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

  await page.getByRole("navigation").getByRole("link", { name: "Accueil" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
});
