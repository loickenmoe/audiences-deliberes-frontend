import { loadEnvConfig } from "@next/env";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Portail Avocat (écrans 30 et 33) **contre le backend réel**.
 *
 * Ce jalon ouvre l'application à un utilisateur **externe**. Le parcours le plus important n'est
 * donc pas le dépôt, c'est le **cloisonnement** : l'avocat ne doit voir que ses dossiers, et rien
 * du portefeuille de la banque. Deux parcours s'y consacrent, dont un qui interroge l'API
 * directement avec son jeton.
 */

loadEnvConfig(process.cwd());

const MOT_DE_PASSE = "Password1!";

const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
);
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

async function jeton(identifiant: string): Promise<string> {
  const reponse = await fetch(`${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: process.env.KEYCLOAK_CLIENT_ID ?? "",
      client_secret: process.env.KEYCLOAK_CLIENT_SECRET ?? "",
      username: identifiant,
      password: MOT_DE_PASSE,
      scope: "openid",
    }),
  });
  if (!reponse.ok) throw new Error(`Connexion refusée pour ${identifiant} (${reponse.status})`);
  return ((await reponse.json()) as { access_token: string }).access_token;
}

async function appel(chemin: string, jetonAcces: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${chemin}`, {
    ...init,
    headers: { Authorization: `Bearer ${jetonAcces}`, "Content-Type": "application/json", ...init.headers },
  });
}

async function json<T>(chemin: string, jetonAcces: string): Promise<T> {
  const reponse = await appel(chemin, jetonAcces);
  if (!reponse.ok) throw new Error(`GET ${chemin} → ${reponse.status} ${await reponse.text()}`);
  return (await reponse.json()) as T;
}

function suffixe() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function seConnecter(page: Page, identifiant: string) {
  await page.goto("/login");
  await page.getByLabel("Identifiant", { exact: true }).fill(identifiant);
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Connexion" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
}

async function pageConnectee(browser: Browser, identifiant: string) {
  const contexte = await browser.newContext({ locale: "fr-FR" });
  const page = await contexte.newPage();
  await seConnecter(page, identifiant);
  return page;
}

test("l'avocat ne voit que ses dossiers, et rien du portefeuille de la banque (Q-96)", async () => {
  const avocat = await jeton("avocat.test");

  const mesDossiers = await json<{ content: { id: number; reference: string }[]; totalElements: number }>(
    "/avocat/mes-dossiers?size=100",
    avocat,
  );
  const tousLesDossiers = await json<{ totalElements: number }>("/dossiers?size=1", await jeton("juriste.test"));

  /*
   * L'avocat ne voit jamais **plus** que ce qui existe. L'inégalité était stricte auparavant, ce qui
   * supposait qu'un autre avocat détienne au moins un dossier — vrai sur la base de l'époque, faux
   * sur une base neuve où `avocat.test` est le seul avocat inscrit : tous les dossiers sont alors
   * légitimement les siens. Une assertion qui dépend de la composition du jeu de données ne mesure
   * pas le cloisonnement ; ce sont la **forme de la réponse** et les **403** ci-dessous qui le font.
   */
  expect(mesDossiers.totalElements).toBeLessThanOrEqual(tousLesDossiers.totalElements);

  // La réponse est réduite à l'identification : aucun champ du portefeuille ne doit filtrer.
  const premier = mesDossiers.content[0];
  expect(premier, "l'avocat de test doit être affecté à au moins un dossier").toBeDefined();
  expect(Object.keys(premier!).sort()).toEqual(["id", "juridictionSaisie", "nature", "reference"]);

  // Les endpoints internes lui restent fermés.
  for (const chemin of ["/dossiers", "/publications", "/clients", "/utilisateurs"]) {
    expect((await appel(chemin, avocat)).status, `${chemin} doit rester fermé à l'avocat`).toBe(403);
  }

  // Et le portail reste fermé aux profils internes, qui ont leurs propres écrans.
  expect((await appel("/avocat/mes-dossiers", await jeton("juriste.test"))).status).toBe(403);
});

test("l'avocat dépose une demande de frais en choisissant son dossier (écran 30)", async ({ browser }) => {
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("link", { name: "Déposer une demande" })
    .click();
  await avocat.waitForURL(/\/frais\/nouvelle/, { timeout: 60_000 });

  const reference = `FAC-E2E-${suffixe()}`;
  // Le sélecteur est alimenté par `GET /avocat/mes-dossiers` : c'est ce que QF-01 rendait impossible.
  await avocat.locator("#frais-dossier").selectOption({ index: 1 });
  await avocat.locator("#frais-reference").fill(reference);
  await avocat.locator("#frais-montant").fill("450000");
  // UC-INT-01 étape 4 : la pièce est un vrai fichier, transmis dès qu'il est choisi (Q-97).
  await avocat
    .locator('input[name="piece-justificative"]')
    .setInputFiles({ name: "facture.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(avocat.getByText("facture.pdf")).toBeVisible({ timeout: 30_000 });
  await avocat.getByRole("button", { name: "Déposer", exact: true }).click();

  await expect(avocat.getByText("Demande de frais déposée.")).toBeVisible({ timeout: 30_000 });
  await avocat.waitForURL(/\/frais$/, { timeout: 60_000 });
  // Sa file (#28) ne montre que les siennes.
  await expect(avocat.getByRole("row", { name: new RegExp(reference) })).toBeVisible({ timeout: 30_000 });

  await avocat.context().close();
});

test("une référence de facture en doublon est signalée sur le champ concerné", async ({ browser }) => {
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/frais/nouvelle");

  const reference = `FAC-DUP-${suffixe()}`;
  for (const tentative of [1, 2]) {
    await avocat.locator("#frais-dossier").selectOption({ index: 1 });
    await avocat.locator("#frais-reference").fill(reference);
    await avocat.locator("#frais-montant").fill("100000");
    await avocat
      .locator('input[name="piece-justificative"]')
      .setInputFiles({ name: "facture.pdf", mimeType: "application/pdf", buffer: PDF });
    await expect(avocat.getByText("facture.pdf")).toBeVisible({ timeout: 30_000 });
    await avocat.getByRole("button", { name: "Déposer", exact: true }).click();
    if (tentative === 1) {
      await expect(avocat.getByText("Demande de frais déposée.")).toBeVisible({ timeout: 30_000 });
      await avocat.goto("/frais/nouvelle");
    }
  }

  // Le backend nomme le champ fautif (QF-21) : le message se pose dessus, pas dans un bandeau.
  await expect(avocat.locator("#frais-reference")).toHaveAttribute("aria-invalid", "true", { timeout: 30_000 });

  await avocat.context().close();
});

test("l'avocat dépose un compte rendu rattaché à une audience de son dossier (écran 33)", async ({
  browser,
}) => {
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/publications/nouvelle");
  await expect(avocat.getByRole("heading", { name: "Déposer une publication", level: 1 })).toBeVisible();

  // Les deux natures de dépôt sont décrites côte à côte, pas cachées derrière des onglets.
  // `exact` : le chapô de l'écran reprend les deux expressions dans sa phrase d'introduction.
  await expect(avocat.getByText("Compte rendu d’audience", { exact: true })).toBeVisible();
  await expect(avocat.getByText("Document du dossier", { exact: true })).toBeVisible();

  // Tant qu'aucun dossier n'est choisi, l'audience ne peut pas l'être : elle lui appartient.
  await expect(avocat.locator("#publication-audience")).toBeDisabled();

  await avocat.locator("#publication-dossier").selectOption({ index: 1 });
  const audiences = avocat.locator("#publication-audience");
  await expect(audiences).toBeEnabled({ timeout: 30_000 });

  const marque = `Renvoi constaté ${suffixe()}`;
  if ((await audiences.locator("option").count()) > 1) {
    await audiences.selectOption({ index: 1 });
    await avocat.locator("#publication-contenu").fill(marque);
    // Q-98 : la pièce est **facultative** — ce dépôt-ci n'en porte pas, et doit aboutir.
    await avocat.getByRole("button", { name: "Déposer le compte rendu" }).click();
    await expect(avocat.getByText("Publication déposée. Elle sera visible après validation.")).toBeVisible({
      timeout: 30_000,
    });
    await avocat.waitForURL(/\/portail/, { timeout: 60_000 });
    await expect(avocat.getByRole("heading", { name: "Mon espace", level: 1 })).toBeVisible();
  } else {
    // Aucune audience planifiée : l'écran l'explique au lieu de laisser un sélecteur vide.
    await expect(avocat.getByText("Aucune audience n’est encore planifiée sur ce dossier.")).toBeVisible();
  }

  await avocat.context().close();
});

/**
 * Q-98 : le récit **et** sa pièce partent en un seul dépôt, rattachés à la même audience. Le volet
 * lecture — l'Assistante qui ouvre la pièce depuis la publication — est vérifié par P2
 * (`parcours-metier.spec.ts`), sur un dossier créé pour l'occasion : ici le dossier est choisi par
 * position, et rien ne garantirait qu'on relise bien ce dépôt-ci.
 */
test("un compte rendu part avec sa pièce, en un seul dépôt", async ({ browser }) => {
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/publications/nouvelle");
  await avocat.locator("#publication-dossier").selectOption({ index: 1 });
  const audiences = avocat.locator("#publication-audience");
  await expect(audiences).toBeEnabled({ timeout: 30_000 });

  if ((await audiences.locator("option").count()) <= 1) return; // dossier sans audience : rien à joindre

  const marque = suffixe();
  await audiences.selectOption({ index: 1 });
  await avocat.locator("#publication-contenu").fill(`Renvoi avec plumitif ${marque}`);
  await avocat
    .locator('input[name="piece-jointe"]')
    .setInputFiles({ name: `plumitif-${marque}.pdf`, mimeType: "application/pdf", buffer: PDF });
  await avocat.getByRole("button", { name: "Déposer le compte rendu" }).click();
  await expect(avocat.getByText("Publication déposée. Elle sera visible après validation.")).toBeVisible({
    timeout: 30_000,
  });

  // Le dépôt apparaît dans son espace, où il relit ce qu'il a transmis.
  await avocat.goto("/portail");
  await expect(avocat.getByRole("heading", { name: "Mon espace", level: 1 })).toBeVisible({ timeout: 30_000 });
  await avocat.context().close();
});

test("l'avocat relit ses dépôts et ses constitutions dans son espace", async ({ browser }) => {
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("link", { name: "Mon espace" })
    .click();
  await avocat.waitForURL(/\/portail/, { timeout: 60_000 });

  await expect(avocat.getByRole("heading", { name: "Mon espace", level: 1 })).toBeVisible();
  await expect(avocat.getByRole("heading", { name: "Mes dépôts", level: 2 })).toBeVisible();
  await expect(avocat.getByRole("heading", { name: "Mes lettres de constitution", level: 2 })).toBeVisible();

  await avocat.context().close();
});

test("le portail reste invisible aux profils internes", async ({ browser }) => {
  const juriste = await pageConnectee(browser, "juriste.test");
  const navigation = juriste.getByRole("navigation", { name: "Navigation principale" });

  for (const entree of ["Mon espace", "Déposer une demande", "Déposer une publication"]) {
    await expect(navigation.getByRole("link", { name: entree })).toHaveCount(0);
  }

  await juriste.goto("/portail");
  await expect(juriste.getByRole("heading", { name: "Vous n’avez pas les droits nécessaires" })).toBeVisible();

  await juriste.context().close();
});

test("les écrans du portail sont traduits", async ({ browser }) => {
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/frais/nouvelle");
  await expect(avocat.getByRole("heading", { name: "Déposer une demande de frais", level: 1 })).toBeVisible();

  await avocat.getByRole("button", { name: "en", exact: true }).click();
  await expect(avocat.getByRole("heading", { name: "File a fee claim", level: 1 })).toBeVisible({
    timeout: 30_000,
  });
  await expect(avocat.getByRole("button", { name: "Submit" })).toBeVisible();

  await avocat.context().close();
});

/**
 * QF-45 — un avocat dont le compte n'est pas encore inscrit au répertoire.
 *
 * Ce test ne s'exécute que si le référentiel ne connaît pas `avocat.test` : sur une base peuplée, le
 * cas n'existe pas, et le forcer supposerait de supprimer une fiche dont d'autres parcours dépendent.
 * Il garde ce qui compte — que cet état soit **expliqué** et non présenté comme une panne, sur les
 * quatre écrans que l'avocat peut atteindre.
 */
test("un compte non rattaché au répertoire est expliqué, pas présenté comme un échec", async ({
  browser,
}) => {
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/portail");

  const explication = avocat.getByText("pas encore rattaché au répertoire");
  if ((await explication.count()) === 0) {
    await avocat.context().close();
    return; // le compte est inscrit : ce n'est pas le cas visé
  }

  for (const chemin of ["/portail", "/frais", "/frais/nouvelle", "/publications/nouvelle"]) {
    await avocat.goto(chemin);
    await expect(
      avocat.getByText("pas encore rattaché au répertoire"),
      `${chemin} doit expliquer l'état du compte`,
    ).toBeVisible({ timeout: 30_000 });
    // Le point de la correction : plus jamais le message d'échec technique.
    await expect(avocat.getByText("Le chargement a échoué")).toHaveCount(0);
  }
  await avocat.context().close();
});
