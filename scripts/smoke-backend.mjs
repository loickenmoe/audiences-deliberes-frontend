/**
 * Vérification du backend réel — à rejouer à chaque jalon avant de passer au suivant.
 *
 * Ne teste pas le backend pour lui-même : vérifie les **hypothèses sur lesquelles le code frontend
 * est bâti**. Chaque contrôle correspond à une décision de conception qui deviendrait fausse si le
 * backend changeait — forme des erreurs, forme de la pagination, forme du claim `roles`, périmètre
 * réel du profil avocat.
 *
 *   node scripts/smoke-backend.mjs        (backend + Keycloak démarrés)
 *
 * Le secret du client Keycloak est lu dans KEYCLOAK_CLIENT_SECRET, sinon dans l'export de realm du
 * dépôt backend. Il n'est jamais affiché.
 */
import { readFile } from "node:fs/promises";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";
const ISSUER = process.env.KEYCLOAK_ISSUER ?? "http://localhost:8081/realms/audiences-realm";
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID ?? "audiences-api";
const REALM_EXPORT =
  process.env.KEYCLOAK_REALM_EXPORT ??
  "../audiences-deliberes-backend/keycloak/audiences-realm.json";

let echecs = 0;

function verifier(intitule, condition, constate) {
  if (condition) {
    console.log(`  ✅ ${intitule}`);
  } else {
    echecs += 1;
    console.log(`  ❌ ${intitule}`);
    if (constate !== undefined) console.log(`     constaté : ${JSON.stringify(constate)}`);
  }
}

async function lireSecret() {
  if (process.env.KEYCLOAK_CLIENT_SECRET) return process.env.KEYCLOAK_CLIENT_SECRET;
  try {
    const realm = JSON.parse(await readFile(REALM_EXPORT, "utf8"));
    return realm.clients?.find((c) => c.clientId === CLIENT_ID)?.secret ?? null;
  } catch {
    return null;
  }
}

async function jetonPour(username, secret) {
  const reponse = await fetch(`${ISSUER}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: secret,
      username,
      password: "Password1!",
      grant_type: "password",
    }),
  });
  if (!reponse.ok) return null;
  return reponse.json();
}

function claims(accessToken) {
  const charge = accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(charge, "base64").toString("utf8"));
}

console.log("\nVérification du backend réel\n" + "─".repeat(60));

// 1 — Disponibilité
console.log("\nDisponibilité");
let sante;
try {
  sante = await (await fetch(`${API.replace("/api/v1", "")}/actuator/health`)).json();
} catch {
  console.error("\n❌ Backend injoignable. Démarrez-le avant de rejouer ce script.\n");
  process.exit(1);
}
verifier("l'API répond et se déclare UP", sante?.status === "UP", sante);

// 2 — Forme des erreurs, socle de lib/api/errors.ts
console.log("\nForme des erreurs (lib/api/errors.ts)");
const nonAuth = await fetch(`${API}/dossiers`);
const corpsNonAuth = await nonAuth.json();
verifier("appel sans jeton → 401", nonAuth.status === 401, nonAuth.status);
verifier(
  "corps { code, message, details }",
  typeof corpsNonAuth.code === "string" &&
    typeof corpsNonAuth.message === "string" &&
    "details" in corpsNonAuth,
  corpsNonAuth,
);
verifier("code ERR-UNAUTHENTICATED", corpsNonAuth.code === "ERR-UNAUTHENTICATED", corpsNonAuth.code);

// 3 — Authentification
console.log("\nAuthentification (QF-05)");
const secret = await lireSecret();
verifier("secret du client disponible", Boolean(secret));
if (!secret) {
  console.error("\n❌ Sans secret, impossible de poursuivre. Voir env.template.\n");
  process.exit(1);
}

const sansSecret = await fetch(`${ISSUER}/protocol/openid-connect/token`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: CLIENT_ID,
    username: "juriste.test",
    password: "Password1!",
    grant_type: "password",
  }),
});
verifier("client confidentiel : le secret est obligatoire", sansSecret.status === 401, sansSecret.status);

const juriste = await jetonPour("juriste.test", secret);
verifier("jeton obtenu pour juriste.test", Boolean(juriste?.access_token));

// 4 — Durées de vie, socle de la stratégie de rafraîchissement (RF-02)
console.log("\nDurées de vie des jetons (RF-02)");
console.log(
  `     access_token ${juriste.expires_in}s · refresh_token ${juriste.refresh_expires_in}s`,
);
verifier(
  "le refresh token est plus court que l'access token — rafraîchir sur refresh_expires_in",
  juriste.refresh_expires_in < juriste.expires_in,
  { access: juriste.expires_in, refresh: juriste.refresh_expires_in },
);

// 5 — Claim des rôles, socle du RBAC
console.log("\nClaim des rôles (types/enums.ts, lib/rbac.ts)");
const cj = claims(juriste.access_token);
verifier("claim `roles` est un tableau", Array.isArray(cj.roles), cj.roles);
verifier(
  "le composite ROLE_SAISIE est déjà résolu dans le jeton",
  cj.roles?.includes("ROLE_SAISIE"),
  cj.roles,
);
verifier("un juriste porte 3 rôles simultanés", cj.roles?.length === 3, cj.roles);
verifier("aucun identifiant numérique d'utilisateur dans le jeton (QF-02)", !("utilisateurId" in cj));

// 6 — Pagination, socle de PageReponse<T>
console.log("\nForme de la pagination (lib/api/client.ts)");
const entetes = { Authorization: `Bearer ${juriste.access_token}` };
const page = await (await fetch(`${API}/dossiers?page=0&size=5`, { headers: entetes })).json();
verifier(
  "{ content, totalPages, totalElements }",
  Array.isArray(page.content) &&
    typeof page.totalPages === "number" &&
    typeof page.totalElements === "number",
  page,
);

// 7 — Référentiels du formulaire de création de dossier
console.log("\nRéférentiels (écran 06)");
const natures = await (await fetch(`${API}/referentiels/natures-dossier`, { headers: entetes })).json();
verifier("taxonomie des natures de dossier peuplée", natures.length > 0, natures.length);
const types = await (await fetch(`${API}/referentiels/types-client-sensible`, { headers: entetes })).json();
verifier("types de client sensible peuplés", types.length > 0, types.length);

// 8 — Provisionnement paresseux (QF-16)
console.log("\nProvisionnement des utilisateurs (QF-16)");
await fetch(`${API}/alertes/mes-notifications`, { headers: entetes });
const utilisateurs = await (await fetch(`${API}/utilisateurs`, { headers: entetes })).json();
verifier(
  "l'utilisateur courant apparaît dans l'annuaire après un appel « utilisateur courant »",
  utilisateurs.some((u) => u.email === cj.email),
  utilisateurs,
);

// 9 — Périmètre du profil avocat (QF-01)
console.log("\nPérimètre du profil avocat (QF-01)");
const avocat = await jetonPour("avocat.test", secret);
const ca = claims(avocat.access_token);
verifier("l'avocat ne porte que ROLE_AVOCAT", ca.roles?.length === 1, ca.roles);
const avocatDossiers = await fetch(`${API}/dossiers`, {
  headers: { Authorization: `Bearer ${avocat.access_token}` },
});
verifier("l'avocat est refusé sur /dossiers (403)", avocatDossiers.status === 403, avocatDossiers.status);

console.log("\n" + "─".repeat(60));
if (echecs === 0) {
  console.log("✅ Toutes les hypothèses du frontend sont vérifiées sur le backend réel.\n");
} else {
  console.log(`❌ ${echecs} hypothèse(s) invalidée(s) — le code frontend repose dessus.\n`);
  process.exit(1);
}
