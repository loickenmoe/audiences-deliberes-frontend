import { loadEnvConfig } from "@next/env";

/**
 * Préparation globale des parcours e2e : garantit le **socle de données** sans lequel aucun
 * dossier n'est créable — au moins un client et au moins un avocat.
 *
 * Les parcours supposaient auparavant que ces données existaient déjà. Une base recréée à neuf
 * (conteneurs Docker supprimés, le 2026-09-10) a suffi à faire échouer dix parcours sur onze, sans
 * qu'aucune ligne de l'application soit en cause. Une suite qui dépend de l'état laissé par
 * l'exécution précédente ne teste pas l'application : elle teste l'historique de la base.
 *
 * Idempotent : ne crée rien si le socle existe, et tolère un 409 si une exécution parallèle l'a
 * créé entre-temps. Passe par l'API réelle — mêmes jetons Keycloak, mêmes contrôles de droits.
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
    // 409 : une autre exécution a créé le même socle entre-temps — c'est le résultat recherché.
    if (reponse.status === 409) return null;
    if (!reponse.ok) {
      throw new Error(`${init.method ?? "GET"} ${chemin} → ${reponse.status} ${await reponse.text()}`);
    }
    return (await reponse.json()) as T;
  }

  const juriste = await jeton("juriste.test");
  const dj = await jeton("dj.test");

  // Premier appel authentifié : provisionne le juriste dans l'annuaire, sans quoi il n'apparaîtrait
  // pas dans la liste des juristes affectables (QF-16).
  await appel("/utilisateurs?profil=JURISTE", juriste);

  const clients = await appel<{ totalElements: number }>("/clients?size=1", juriste);
  if (clients && clients.totalElements === 0) {
    await appel("/clients", juriste, {
      method: "POST",
      body: JSON.stringify({ reference: "CLI-SOCLE-E2E", nom: "Client socle des parcours" }),
    });
  }

  const avocats = await appel<unknown[]>("/intervenants?type=AVOCAT", juriste);
  if (avocats && avocats.length === 0) {
    // La création d'un intervenant est réservée au DJ/DJA (#61).
    await appel("/intervenants", dj, {
      method: "POST",
      body: JSON.stringify({ type: "AVOCAT", nom: "Me Socle des parcours", compteKeycloak: "avocat.socle.e2e" }),
    });
  }
}

function exiger(nom: string): string {
  const valeur = process.env[nom];
  if (!valeur) throw new Error(`Variable ${nom} absente de .env.local : les parcours e2e en ont besoin.`);
  return valeur;
}
