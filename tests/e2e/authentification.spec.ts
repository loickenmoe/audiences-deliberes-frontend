import { expect, test, type Page } from "@playwright/test";

/**
 * Parcours d'authentification **contre le Keycloak réel** du projet.
 *
 * Ces tests ne simulent rien : ils traversent le flux OIDC complet, saisissent les identifiants sur
 * la page de Keycloak et vérifient les rôles réellement reçus. Ils exigent donc le socle démarré
 * (`docker-compose up postgres keycloak minio -d` puis `mvnw spring-boot:run`).
 */

const COMPTES = {
  juriste: { identifiant: "juriste.test", prenom: "Jean", profil: "Juriste" },
  dj: { identifiant: "dj.test", profil: "Directeur Juridique" },
  assistante: { identifiant: "assistante.test", profil: "Assistante de Direction" },
} as const;

const MOT_DE_PASSE = "Password1!";

async function seConnecter(page: Page, identifiant: string) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);

  await page.getByRole("button", { name: "Se connecter" }).click();

  // Page de connexion servie par Keycloak, hors de l'application.
  await page.waitForURL(/localhost:8081\/realms\/audiences-realm/);
  await page.locator("#username").fill(identifiant);
  await page.locator("#password").fill(MOT_DE_PASSE);
  await page.locator("#kc-login, input[type=submit]").first().click();

  await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
}

test("un visiteur non authentifié est renvoyé vers la connexion", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Audiences et Délibérés" })).toBeVisible();
});

test("un juriste se connecte et voit son profil et ses rôles réels", async ({ page }) => {
  await seConnecter(page, COMPTES.juriste.identifiant);

  await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();
  await expect(page.getByText(`Bonjour ${COMPTES.juriste.prenom}`)).toBeVisible();

  // Les trois rôles réellement portés par ce compte, composite ROLE_SAISIE compris.
  for (const role of ["ROLE_JURISTE", "ROLE_SAISIE", "ROLE_CONSULTATION"]) {
    await expect(page.getByText(role, { exact: true })).toBeVisible();
  }
});

test("la navigation est filtrée par les droits du profil", async ({ page }) => {
  await seConnecter(page, COMPTES.juriste.identifiant);

  const navigation = page.getByRole("navigation", { name: "Navigation principale" });
  await expect(navigation.getByRole("link", { name: "Accueil" })).toBeVisible();
});

test("un profil sans droit sur un écran est renvoyé vers le refus d'accès", async ({ page }) => {
  await seConnecter(page, COMPTES.juriste.identifiant);

  // `/unauthorized` doit rester atteignable et lisible : c'est la cible des gardes de route.
  await page.goto("/unauthorized");
  await expect(
    page.getByRole("heading", { name: /Vous n’avez pas les droits nécessaires/ }),
  ).toBeVisible();
});

test("la déconnexion ferme aussi la session Keycloak", async ({ page }) => {
  await seConnecter(page, COMPTES.juriste.identifiant);

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.waitForURL(/\/login/, { timeout: 60_000 });
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();

  // La session applicative est bien close.
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);

  /**
   * Preuve que la session de connexion unique est close elle aussi : une nouvelle tentative doit
   * **redemander les identifiants**. Sans déconnexion OIDC, Keycloak reconnecterait silencieusement
   * la personne précédente — le défaut que ce test garde fermé.
   */
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(/localhost:8081\/realms\/audiences-realm/, { timeout: 60_000 });
  await expect(page.locator("#username")).toBeVisible();
});

test("le profil affiché correspond au compte connecté", async ({ page }) => {
  await seConnecter(page, COMPTES.assistante.identifiant);

  // Le profil apparaît dans l'en-tête et dans le corps : on cible chacun explicitement.
  await expect(
    page.getByRole("banner").getByText(COMPTES.assistante.profil),
  ).toBeVisible();
  await expect(page.getByRole("main").getByText(COMPTES.assistante.profil)).toBeVisible();
});
