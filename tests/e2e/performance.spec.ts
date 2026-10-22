import { loadEnvConfig } from "@next/env";
import { expect, test, type Page } from "@playwright/test";

/**
 * Contract performance targets: NF-PERF-01 (common requests < 2 s, sized for 50 concurrent users)
 * and NF-PERF-02 (report generation < 10 s). Measured at the API level (what NF-PERF-01 states) and
 * at the screen level (network, rendering and hydration: what the user experiences). Measured on
 * the development database; this is not a 50-user load test.
 */

loadEnvConfig(process.cwd());

const MOT_DE_PASSE = "Password1!";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

/** NF-PERF-01. */
const BUDGET_REQUETE = 2_000;
/** NF-PERF-02. */
const BUDGET_RAPPORT = 10_000;
/**
 * Screen budget: the 2 s target applies to the request; display adds server rendering, transfer
 * and hydration. Exceeding 4 s signals a regression.
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

/** Times a call once the cache is warm: measures steady state, not startup. */
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
  // `GET /frais/demandes` is not open to the legal officer (AVOCAT, ASSISTANTE, DJA, DJ): measured
  // with the DJ token, like the dashboard.
  for (const chemin of ["/frais/demandes?size=20", "/tableau-de-bord"]) {
    mesures.push({ chemin, duree: await mesurerApi(chemin, dj) });
  }

  const depassements = mesures.filter((m) => m.duree >= BUDGET_REQUETE);
  // The message names the endpoints and their duration, so the failure is actionable.
  expect(
    depassements.map((m) => `${m.chemin} : ${m.duree} ms`),
    `NF-PERF-01 (< ${BUDGET_REQUETE} ms) dépassé`,
  ).toEqual([]);
});

/**
 * The consolidated client view is the heaviest request: it returns all of a client's cases without
 * pagination. This check guards against an N+1 regression.
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
    // A first visit warms up the route; the second one is measured, as for the API.
    await page.goto(chemin);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });

    const debut = Date.now();
    await page.goto(chemin);
    // The expected title is not always the `h1`: the home page opens on a personal greeting, and
    // the work queues block proves the data has loaded.
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
