import type { DefaultSession } from "next-auth";

/**
 * Le modèle « un rôle par utilisateur » du projet de référence est remplacé par `roles: string[]` :
 * dans ce domaine, un utilisateur porte simultanément son profil métier, `ROLE_CONSULTATION` et
 * `ROLE_SAISIE`. Vérifié en réel : `juriste.test` reçoit trois rôles dans son jeton.
 */
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    /** Jeton d'identité, requis par la déconnexion OIDC (`id_token_hint`). */
    idToken?: string;
    roles: string[];
    /** Positionné quand la rotation du jeton a définitivement échoué : impose une reconnexion. */
    erreur?: string;
    user: {
      keycloakId?: string;
      nom?: string | null;
      prenom?: string | null;
    } & DefaultSession["user"];
  }
}

/**
 * L'augmentation vise **`@auth/core/jwt`** et non `next-auth/jwt` : ce dernier se contente d'un
 * `export * from "@auth/core/jwt"`, et une réexportation ne permet pas d'enrichir l'interface
 * d'origine. Viser le mauvais module laisse silencieusement chaque champ en `unknown`.
 */
declare module "@auth/core/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
    /** Époque en millisecondes. */
    expiresAt?: number;
    /** Époque en millisecondes. Plus courte que `expiresAt` sur ce realm — cf. RF-02. */
    refreshExpiresAt?: number;
    roles?: string[];
    keycloakId?: string;
    nom?: string | null;
    prenom?: string | null;
    erreur?: string;
  }
}

export {};
