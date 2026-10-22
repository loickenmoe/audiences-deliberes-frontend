import { loadEnvConfig } from "@next/env";

/**
 * Global e2e setup: guarantees the baseline data without which no case can be created (at least
 * one client and one lawyer), so the suite does not depend on the state left by a previous run.
 *
 * Idempotent: creates nothing if the baseline exists, and tolerates a 409 if a parallel run created
 * it meanwhile. Goes through the real API (same Keycloak tokens, same permission checks).
 */
export default async function preparation() {
  loadEnvConfig(process.cwd());

  const issuer = exiger("KEYCLOAK_ISSUER");
  const clientId = exiger("KEYCLOAK_CLIENT_ID");
  const secret = exiger("KEYCLOAK_CLIENT_SECRET");
  const api = exiger("NEXT_PUBLIC_API_URL");

  async function jeton(identifiant: string): Promise<string> {
    const reponse = await fetch(`${issuer}/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: clientId,
        client_secret: secret,
        username: identifiant,
        password: "Password1!",
        scope: "openid",
      }),
    }).catch(() => {
      throw new Error(`Keycloak injoignable (${issuer}) : démarrez les conteneurs du backend.`);
    });
    if (!reponse.ok) {
      throw new Error(`Connexion refusée pour ${identifiant} (${reponse.status}) : realm à jour ?`);
    }
    return ((await reponse.json()) as { access_token: string }).access_token;
  }

  async function appel<T>(chemin: string, jetonAcces: string, init: RequestInit = {}): Promise<T | null> {
    const reponse = await fetch(`${api}${chemin}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${jetonAcces}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    }).catch(() => {
      throw new Error(`Backend injoignable (${api}) : démarrez l'application backend.`);
    });
    // 409: another run created the same baseline meanwhile, which is the desired outcome.
    if (reponse.status === 409) return null;
    if (!reponse.ok) {
      throw new Error(`${init.method ?? "GET"} ${chemin} → ${reponse.status} ${await reponse.text()}`);
    }
    return (await reponse.json()) as T;
  }

  const juriste = await jeton("juriste.test");
  const dj = await jeton("dj.test");

  /*
   * Provisions the test users in the directory, otherwise they would not appear in the list of
   * assignable legal officers. Provisioning happens when the server resolves the current user;
   * `GET /utilisateurs` only reads the directory, hence this call (the one the notification bell
   * makes when the application opens).
   */
  await appel("/alertes/mes-notifications?size=1", juriste);
  await appel("/alertes/mes-notifications?size=1", dj);

  const clients = await appel<{ totalElements: number }>("/clients?size=1", juriste);
  if (clients && clients.totalElements === 0) {
    await appel("/clients", juriste, {
      method: "POST",
      body: JSON.stringify({ reference: "CLI-SOCLE-E2E", nom: "Client socle des parcours" }),
    });
  }

  /*
   * Portal journeys log in as `avocat.test`, so that account must be linked to a lawyer in the
   * reference data. The response is paginated; `size` is explicit to search the whole directory.
   */
  const avocats =
    (await appel<{ content: { id: number; compteKeycloak: string | null }[] }>(
      "/intervenants?type=AVOCAT&size=200",
      juriste,
    ))?.content ?? [];

  const avocatDuCompteTest = avocats.find((a) => a.compteKeycloak === "avocat.test");
  if (!avocatDuCompteTest) {
    // Creating a party is restricted to DJ/DJA.
    await appel("/intervenants", dj, {
      method: "POST",
      body: JSON.stringify({ type: "AVOCAT", nom: "Me Claire Avocat", compteKeycloak: "avocat.test" }),
    });
  }
}

function exiger(nom: string): string {
  const valeur = process.env[nom];
  if (!valeur) throw new Error(`Variable ${nom} absente de .env.local : les parcours e2e en ont besoin.`);
  return valeur;
}
