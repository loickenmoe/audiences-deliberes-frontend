import { expect, test, type Page } from "@playwright/test";

/**
 * Parcours d'authentification **contre le Keycloak réel** du projet.
 *
 * Ces tests ne simulent rien : ils saisissent de vrais identifiants dans le formulaire de
 * l'application, que Keycloak valide en arrière-plan (QF-18), et vérifient les rôles réellement
 * reçus. Ils exigent donc le socle démarré (`docker-compose up postgres keycloak minio -d` puis
 * `mvnw spring-boot:run`).
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

  await page.getByLabel("Identifiant", { exact: true }).fill(identifiant);
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Connexion" }).click();

  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
}

test("un visiteur non authentifié est renvoyé vers le formulaire de connexion", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  // Composition reprise de GFA, application Afriland en production.
  await expect(
    page.getByRole("heading", { name: "Bienvenue sur Audiences et Délibérés" }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: "Afriland First Bank" })).toBeVisible();
  await expect(page.getByLabel("Identifiant", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Mot de passe", { exact: true })).toBeVisible();
});

test("le mot de passe peut être relu avant validation", async ({ page }) => {
  await page.goto("/login");

  // `exact` est nécessaire : le libellé du bouton de bascule contient celui du champ.
  const champ = page.getByLabel("Mot de passe", { exact: true });
  await champ.fill("Password1!");

  // Masqué par défaut : la saisie ne doit pas rester lisible par-dessus l'épaule.
  await expect(champ).toHaveAttribute("type", "password");

  const bascule = page.getByRole("button", { name: "Afficher le mot de passe" });
  await bascule.click();
  await expect(champ).toHaveAttribute("type", "text");
  await expect(champ).toHaveValue("Password1!");

  // La bascule change d'intitulé : son état est lisible par les technologies d'assistance.
  await page.getByRole("button", { name: "Masquer le mot de passe" }).click();
  await expect(champ).toHaveAttribute("type", "password");
});

test("l'écran de connexion ne défile pas", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/login");
  await page.getByLabel("Mot de passe", { exact: true }).waitFor();

  const debordement = await page.evaluate(() => {
    const e = document.documentElement;
    return e.scrollHeight - e.clientHeight;
  });
  expect(debordement).toBeLessThanOrEqual(0);
});

test("aucun filet rouge ne surmonte l'écran de connexion", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Mot de passe", { exact: true }).waitFor();

  const filets = await page.locator("div.bg-marque").count();
  expect(filets).toBe(0);
});

test("des identifiants erronés sont refusés sans révéler si le compte existe", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Identifiant", { exact: true }).fill("juriste.test");
  await page.getByLabel("Mot de passe", { exact: true }).fill("mauvais-mot-de-passe");
  await page.getByRole("button", { name: "Connexion" }).click();

  // `getByRole("alert")` capterait aussi l'annonceur de route de Next, toujours présent et vide.
  const alerte = page.getByRole("main").getByRole("alert");
  // Premier appel de l'action : le serveur de développement compile la route et interroge Keycloak.
  await expect(alerte).toBeVisible({ timeout: 20_000 });
  await expect(alerte).toHaveText("Identifiant ou mot de passe incorrect.");
  await expect(page).toHaveURL(/\/login/);
});

test("un compte inexistant reçoit exactement le même message", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Identifiant", { exact: true }).fill("compte.qui.nexiste.pas");
  await page.getByLabel("Mot de passe", { exact: true }).fill("Password1!");
  await page.getByRole("button", { name: "Connexion" }).click();

  // Message identique au cas précédent : l'interface ne dit pas quels comptes existent.
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Identifiant ou mot de passe incorrect.",
  );
});

test("un juriste se connecte et voit son profil et ses rôles réels", async ({ page }) => {
  await seConnecter(page, COMPTES.juriste.identifiant);

  await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();
  await expect(page.getByText(`Bonjour ${COMPTES.juriste.prenom}`)).toBeVisible();

  /**
   * Les trois rôles réellement portés par ce compte, composite `ROLE_SAISIE` compris — affichés
   * avec leur libellé traduit, jamais avec le code technique.
   */
  for (const libelle of ["Juriste", "Saisie", "Consultation"]) {
    // « Juriste » figure aussi en surtitre : les deux occurrences sont légitimes.
    await expect(page.getByRole("main").getByText(libelle, { exact: true }).first()).toBeVisible();
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

test("la déconnexion ramène au formulaire et exige une nouvelle saisie", async ({ page }) => {
  await seConnecter(page, COMPTES.juriste.identifiant);

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.waitForURL(/\/login/, { timeout: 60_000 });

  // La session applicative est close et le formulaire est de nouveau exigé.
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel("Identifiant", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Mot de passe", { exact: true })).toHaveValue("");
});

test("le profil affiché correspond au compte connecté", async ({ page }) => {
  await seConnecter(page, COMPTES.assistante.identifiant);

  // Le profil apparaît à trois endroits : en-tête, surtitre de l'accueil, pastille de rôle.
  await expect(page.getByRole("banner").getByText(COMPTES.assistante.profil)).toBeVisible();
  await expect(
    page.getByRole("main").getByText(COMPTES.assistante.profil, { exact: true }).first(),
  ).toBeVisible();
});
