import { z } from "zod";

/**
 * Validation de la configuration au démarrage.
 *
 * Choix délibéré : **échec explicite** si une variable manque ou est malformée, là où le projet de
 * référence se contentait d'un avertissement en console. Une URL d'API absente doit arrêter
 * l'application au démarrage, pas produire des appels vers `undefined/api/v1/dossiers` découverts
 * en recette.
 *
 * Les variables d'authentification (Keycloak, NextAuth) seront ajoutées au jalon F2, quand le code
 * les consommera réellement — on ne valide que ce qui est utilisé.
 */
const schema = z.object({
  /** Base de l'API backend, préfixe inclus. Ex. http://localhost:8080/api/v1 */
  NEXT_PUBLIC_API_URL: z.string().url("NEXT_PUBLIC_API_URL doit être une URL absolue valide"),
  /** Endpoint SockJS du canal temps réel. Consommé à partir du jalon F14. */
  NEXT_PUBLIC_WS_URL: z.string().url("NEXT_PUBLIC_WS_URL doit être une URL absolue valide"),
});

export type Env = z.infer<typeof schema>;

/**
 * Next.js n'expose au navigateur que les variables littéralement référencées par
 * `process.env.NEXT_PUBLIC_*` à la compilation : elles doivent donc être écrites en toutes lettres,
 * jamais lues dynamiquement.
 */
function read(): Env {
  const parsed = schema.safeParse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")} : ${issue.message}`)
      .join("\n");
    throw new Error(
      `Configuration invalide. Renseignez les variables manquantes dans .env.local ` +
        `(voir env.template) :\n${details}`,
    );
  }

  return parsed.data;
}

let cache: Env | null = null;

/** Configuration validée. Lève une erreur explicite au premier appel si elle est incomplète. */
export function getEnv(): Env {
  cache ??= read();
  return cache;
}

/** Réinitialise le cache — réservé aux tests. */
export function resetEnvCache(): void {
  cache = null;
}
