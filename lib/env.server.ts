import "server-only";

import { z } from "zod";

/**
 * Server-only configuration. Importing `server-only` fails the build if a client component reaches
 * this module: the Keycloak client secret must never reach the browser bundle.
 */
const schema = z.object({
  /** NextAuth session encryption key. `openssl rand -base64 32`. */
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET doit faire au moins 32 caractères"),
  /** Realm OIDC issuer, e.g. http://localhost:8081/realms/audiences-realm */
  KEYCLOAK_ISSUER: z.string().url("KEYCLOAK_ISSUER doit être une URL absolue valide"),
  KEYCLOAK_CLIENT_ID: z.string().min(1),
  /**
   * `audiences-api` is a confidential client: the secret is required (a token request without it is
   * rejected with `unauthorized_client`).
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
