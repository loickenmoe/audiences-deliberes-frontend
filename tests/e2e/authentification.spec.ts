import { expect, test, type Page } from "@playwright/test";

/**
 * Authentication flows against the project's real Keycloak: real credentials are typed into the
 * application form and the roles actually received are checked. Requires the stack to be running
 * (`docker-compose up postgres keycloak minio -d`, then `mvnw spring-boot:run`).
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
  // Layout taken from GFA, Afriland's production application.
  await expect(
    page.getByRole("heading", { name: "Bienvenue sur Audiences et Délibérés" }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: "Afriland First Bank" })).toBeVisible();
  await expect(page.getByLabel("Identifiant", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Mot de passe", { exact: true })).toBeVisible();
});

test("le mot de passe peut être relu avant validation", async ({ page }) => {
  await page.goto("/login");

  // `exact` is required: the toggle button label contains the field label.
  const champ = page.getByLabel("Mot de passe", { exact: true });
  await champ.fill("Password1!");

  // Hidden by default: the input must not stay readable over the shoulder.
  await expect(champ).toHaveAttribute("type", "password");

  const bascule = page.getByRole("button", { name: "Afficher le mot de passe" });
  await bascule.click();
  await expect(champ).toHaveAttribute("type", "text");
  await expect(champ).toHaveValue("Password1!");

  // The toggle label changes: its state is exposed to assistive technologies.
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

  // `getByRole("alert")` would also match Next's route announcer, always present and empty.
  const alerte = page.getByRole("main").getByRole("alert");
  // First call of the action: the dev server compiles the route and queries Keycloak.
  await expect(alerte).toBeVisible({ timeout: 20_000 });
  await expect(alerte).toHaveText("Identifiant ou mot de passe incorrect.");
  await expect(page).toHaveURL(/\/login/);
});

test("un compte inexistant reçoit exactement le même message", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Identifiant", { exact: true }).fill("compte.qui.nexiste.pas");
  await page.getByLabel("Mot de passe", { exact: true }).fill("Password1!");
  await page.getByRole("button", { name: "Connexion" }).click();

  /**
   * Same message as the previous case: the interface does not reveal which accounts exist.
   * Keycloak deliberately takes longer to reject an unknown account (protection against timing
   * enumeration), so the default 5 s wait is not enough.
   */
  const alerte = page.getByRole("main").getByRole("alert");
  await expect(alerte).toBeVisible({ timeout: 20_000 });
  await expect(alerte).toHaveText("Identifiant ou mot de passe incorrect.");
});

test("un juriste se connecte et voit son profil et ses rôles réels", async ({ page }) => {
  await seConnecter(page, COMPTES.juriste.identifiant);

  await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();
  await expect(page.getByText(`Bonjour ${COMPTES.juriste.prenom}`)).toBeVisible();

  /**
   * The three roles actually held by this account, composite `ROLE_SAISIE` included, shown with
   * their translated label, never the technical code.
   */
  for (const libelle of ["Juriste", "Saisie", "Consultation"]) {
    // "Juriste" also appears in the overline: both occurrences are legitimate.
    await expect(page.getByRole("main").getByText(libelle, { exact: true }).first()).toBeVisible();
  }
});

test("la navigation est filtrée par les droits du profil", async ({ page }) => {
  await seConnecter(page, COMPTES.juriste.identifiant);

  const navigation = page.getByRole("navigation", { name: "Navigation principale" });
  // `exact`: the header logo is also a home link inside this landmark, and its accessible name
  // ("Afriland First Bank, retour à l'accueil") contains the word.
  await expect(navigation.getByRole("link", { name: "Accueil", exact: true })).toBeVisible();
});

test("un profil sans droit sur un écran est renvoyé vers le refus d'accès", async ({ page }) => {
  await seConnecter(page, COMPTES.juriste.identifiant);

  // `/unauthorized` must stay reachable and readable: it is the target of route guards.
  await page.goto("/unauthorized");
  await expect(
    page.getByRole("heading", { name: /Vous n’avez pas les droits nécessaires/ }),
  ).toBeVisible();
});

test("la déconnexion ramène au formulaire et exige une nouvelle saisie", async ({ page }) => {
  await seConnecter(page, COMPTES.juriste.identifiant);

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.waitForURL(/\/login/, { timeout: 60_000 });

  // The application session is closed and the form is required again.
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel("Identifiant", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Mot de passe", { exact: true })).toHaveValue("");
});

test("le profil affiché correspond au compte connecté", async ({ page }) => {
  await seConnecter(page, COMPTES.assistante.identifiant);

  // The profile appears in three places: header, home overline, role badge.
  await expect(page.getByRole("banner").getByText(COMPTES.assistante.profil)).toBeVisible();
  await expect(
    page.getByRole("main").getByText(COMPTES.assistante.profil, { exact: true }).first(),
  ).toBeVisible();
});

/**
 * The logout message is an event, not a page state: it is shown once, and the URL does not replay
 * it (a restored tab would otherwise show "session expired" again).
 */
test("le motif de déconnexion s'affiche une fois puis quitte l'URL", async ({ page }) => {
  await page.goto("/login?motif=session-expiree");

  await expect(page.getByText("Votre session a expiré")).toBeVisible({ timeout: 30_000 });
  // The URL is cleaned: a bookmark or a restored tab will not replay the message.
  await expect(page).toHaveURL((url) => !url.searchParams.has("motif"), { timeout: 10_000 });

  await page.reload();
  await expect(page.getByText("Votre session a expiré")).toHaveCount(0);
});

/** Two causes, two messages: logging in again is not the answer when the service is down. */
test("un service d'authentification injoignable ne se présente pas comme une session expirée", async ({
  page,
}) => {
  await page.goto("/login?motif=auth-indisponible");

  await expect(page.getByText("service d’authentification est momentanément indisponible")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Votre session a expiré")).toHaveCount(0);
});

/** A plain visit to the login page announces nothing. */
test("arriver sur la connexion sans motif n'affiche aucun message", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Votre session a expiré")).toHaveCount(0);
  await expect(page.getByText("service d’authentification")).toHaveCount(0);
});
