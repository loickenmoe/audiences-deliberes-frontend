import type { DefaultSession } from "next-auth";

/**
 * `roles: string[]`: a user holds their business profile, `ROLE_CONSULTATION` and `ROLE_SAISIE` at
 * the same time.
 */
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    /** ID token, required by OIDC logout (`id_token_hint`). */
    idToken?: string;
    roles: string[];
    /** Set when token rotation has definitively failed: forces a new login. */
    erreur?: string;
    /**
     * Epoch in milliseconds from which the server will renew the tokens, so the browser knows how
     * long to keep its token in memory. Computed by `prochainRafraichissement`, never client-side.
     */
    rafraichirApres?: number;
    user: {
      keycloakId?: string;
      nom?: string | null;
      prenom?: string | null;
    } & DefaultSession["user"];
  }
}

/**
 * Augments `@auth/core/jwt`, not `next-auth/jwt`: the latter only re-exports it, and a re-export
 * cannot be augmented (every field would silently stay `unknown`).
 */
declare module "@auth/core/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
    /** Epoch in milliseconds. */
    expiresAt?: number;
    /** Epoch in milliseconds. Earlier than `expiresAt` on this realm. */
    refreshExpiresAt?: number;
    roles?: string[];
    keycloakId?: string;
    nom?: string | null;
    prenom?: string | null;
    erreur?: string;
  }
}

export {};
