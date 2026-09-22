import { loadEnvConfig } from "@next/env";
import { expect, test, type Page } from "@playwright/test";

/**
 * Cibles de performance du contrat : **NF-PERF-01** (« temps de réponse des requêtes courantes
 * < 2 secondes », dimensionné pour 50 utilisateurs simultanés) et **NF-PERF-02** (« temps de
 * génération d'un rapport < 10 secondes »).
 *
 * **Deux mesures, parce que l'exigence et le ressenti ne sont pas la même chose.**
 * 1. *Au niveau de l'API* : la durée de la requête elle-même, ce que NF-PERF-01 énonce à la lettre.
 * 2. *Au niveau de l'écran* : le délai entre la navigation et l'affichage des données. Il inclut
 *    l'aller-retour réseau, le rendu et l'hydratation — c'est ce que l'utilisateur subit.
 *
 * La mesure vaut pour **cette base de développement**, dont le volume a crû au fil des jalons
 * (plusieurs centaines de dossiers, un client en portant 355). Elle ne remplace pas un essai de
 * charge à 50 utilisateurs, qui relève de la recette d'infrastructure.
 */

loadEnvConfig(process.cwd());

const MOT_DE_PASSE = "Password1!";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

/** NF-PERF-01. */
const BUDGET_REQUETE = 2_000;
/** NF-PERF-02. */
const BUDGET_RAPPORT = 10_000;
/**
 * Budget de l'écran : la cible de 2 s porte sur la requête. L'affichage y ajoute le rendu serveur,
 * le transfert et l'hydratation ; 4 s est le seuil retenu pour ce jalon, et il est **mesuré**, non
 * supposé. Un écran qui le dépasse signale une régression, pas une fatalité.
 */
const BUDGET_ECRAN = 4_000;

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

/** Mesure la durée d'un appel, une fois le cache chaud : on chronomètre le régime, pas le démarrage. */
async function mesurerApi(chemin: string, jetonAcces: string): Promise<number> {
  const appel = async () =>
    fetch(`${API}${chemin}`, { headers: { Authorization: `Bearer ${jetonAcces}` } });
  const chauffe = await appel();
  expect(chauffe.status, `${chemin} doit répondre`).toBeLessThan(400);

  const debut = Date.now();
  const reponse = await appel();
  const duree = Date.now() - debut;
  expect(reponse.status).toBeLessThan(400);
  return duree;
}

async function seConnecter(page: Page, identifiant: string) {
  await page.goto("/login");
  await page.getByLabel("Identifiant", { exact: true }).fill(identifiant);
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Connexion" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
}

test("NF-PERF-01 — les requêtes courantes répondent en moins de 2 secondes", async () => {
  const juriste = await jeton("juriste.test");
  const dj = await jeton("dj.test");

  const mesures: { chemin: string; duree: number }[] = [];
  for (const chemin of [
    "/dossiers?size=20",
    "/dossiers?mesDossiers=true&size=20",
    "/clients?size=20",
    "/intervenants?type=AVOCAT",
    "/utilisateurs",
    "/referentiels/natures-dossier",
    "/alertes/mes-notifications?size=20",
    "/publications?size=20",
    "/jurisprudences?size=20",
    "/configurations",
  ]) {
    mesures.push({ chemin, duree: await mesurerApi(chemin, juriste) });
  }
  // `GET /frais/demandes` n'est pas ouvert au juriste (AVOCAT, ASSISTANTE, DJA, DJ) : mesuré avec
  // le jeton du DJ, comme le tableau de bord.
  for (const chemin of ["/frais/demandes?size=20", "/tableau-de-bord"]) {
    mesures.push({ chemin, duree: await mesurerApi(chemin, dj) });
  }

  const depassements = mesures.filter((m) => m.duree >= BUDGET_REQUETE);
  // Le message nomme les endpoints et leur durée : « trop lent » seul n'aide personne à corriger.
  expect(
    depassements.map((m) => `${m.chemin} : ${m.duree} ms`),
    `NF-PERF-01 (< ${BUDGET_REQUETE} ms) dépassé`,
  ).toEqual([]);
});

/**
 * La vue consolidée d'un client est la requête la plus lourde du contrat : elle renvoie **tous** les
 * dossiers d'un client, sans pagination. Elle a dépassé 19 secondes avant Q-94 (N+1) ; ce contrôle
 * garde la correction fermée.
 */
test("NF-PERF-01 — la vue consolidée d'un client tient le budget malgré son volume", async () => {
  const juriste = await jeton("juriste.test");
  const duree = await mesurerApi("/clients/1/dossiers", juriste);
  expect(duree, `vue consolidée : ${duree} ms`).toBeLessThan(BUDGET_REQUETE);
});

test("NF-PERF-02 — un rapport se génère en moins de 10 secondes", async () => {
  const juriste = await jeton("juriste.test");
  const duree = await mesurerApi(
    "/rapports?type=ANNUEL&dateDebut=2020-01-01&dateFin=2030-12-31&format=JSON",
    juriste,
  );
  expect(duree, `génération du rapport : ${duree} ms`).toBeLessThan(BUDGET_RAPPORT);
});

test("les écrans courants affichent leurs données dans le budget", async ({ page }) => {
  await seConnecter(page, "dj.test");

  const mesures: { chemin: string; duree: number }[] = [];
  for (const { chemin, attendu } of [
    { chemin: "/", attendu: "Ce qui vous attend" },
    { chemin: "/dossiers", attendu: "Dossiers" },
    { chemin: "/frais", attendu: "Frais" },
    { chemin: "/notifications", attendu: "Mes notifications" },
    { chemin: "/tableau-de-bord", attendu: "Tableau de bord" },
  ]) {
    // Une première visite amorce la route ; on mesure la seconde, comme pour l'API.
    await page.goto(chemin);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });

    const debut = Date.now();
    await page.goto(chemin);
    // Le titre attendu n'est pas toujours le `h1` : l'accueil ouvre sur une salutation nominative,
    // et c'est le bloc des files qui prouve que les données sont là.
    await expect(page.getByRole("heading", { name: new RegExp(attendu) }).first()).toBeVisible({
      timeout: BUDGET_ECRAN,
    });
    mesures.push({ chemin, duree: Date.now() - debut });
  }

  const depassements = mesures.filter((m) => m.duree >= BUDGET_ECRAN);
  expect(
    depassements.map((m) => `${m.chemin} : ${m.duree} ms`),
    `budget d'affichage (< ${BUDGET_ECRAN} ms) dépassé`,
  ).toEqual([]);
});
