import "server-only";

import { z } from "zod";

/**
 * Configuration **serveur uniquement**. L'import de `server-only` fait échouer la compilation si un
 * composant client atteint ce module : le secret du client Keycloak ne doit jamais partir dans le
 * paquet navigateur.
 */
const schema = z.object({
  /** Clé de chiffrement de la session NextAuth. `openssl rand -base64 32`. */
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET doit faire au moins 32 caractères"),
  /** Émetteur OIDC du realm. Ex. http://localhost:8081/realms/audiences-realm */
  KEYCLOAK_ISSUER: z.string().url("KEYCLOAK_ISSUER doit être une URL absolue valide"),
  KEYCLOAK_CLIENT_ID: z.string().min(1),
  /**
   * `audiences-api` est un client **confidentiel** : le secret est obligatoire. Vérifié en réel —
   * une demande de jeton sans secret est refusée en `unauthorized_client`, contrairement à ce que
   * laisse penser la commande du README du backend (QF-05).
   */
  KEYCLOAK_CLIENT_SECRET: z.string().min(1, "KEYCLOAK_CLIENT_SECRET est obligatoire"),
});

export type EnvServeur = z.infer<typeof schema>;

let cache: EnvServeur | null = null;

export function getEnvServeur(): EnvServeur {
  if (cache) return cache;

  const parsed = schema.safeParse({
    AUTH_SECRET: process.env.AUTH_SECRET,
    KEYCLOAK_ISSUER: process.env.KEYCLOAK_ISSUER,
    KEYCLOAK_CLIENT_ID: process.env.KEYCLOAK_CLIENT_ID,
    KEYCLOAK_CLIENT_SECRET: process.env.KEYCLOAK_CLIENT_SECRET,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")} : ${issue.message}`)
      .join("\n");
    throw new Error(
      `Configuration d'authentification invalide. Renseignez .env.local (voir env.template) :\n` +
        details,
    );
  }

  cache = parsed.data;
  return cache;
}
