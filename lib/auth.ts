import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { getEnvServeur } from "@/lib/env.server";
import {
  ERREUR_AUTH_INDISPONIBLE,
  ERREUR_RAFRAICHISSEMENT,
  doitRafraichir,
  prochainRafraichissement,
} from "@/lib/rotation-jeton";

/**
 * Authentication through an in-app login form, backed by Keycloak.
 *
 * The form lives in the application for visual consistency with the bank's other internal apps.
 * Keycloak remains the sole identity holder and token issuer; it validates credentials through the
 * password grant (`grant_type=password`, `directAccessGrantsEnabled` on the `audiences-api` client).
 *
 * The password never leaves the server: `authorize` runs in Next.js and the password is never in
 * the browser bundle, the session or any log.
 *
 * Known limits: no second factor, no password reset, no cross-app SSO. If any of these is enabled
 * on the realm, this flow must be revisited.
 */

interface JetonsKeycloak {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
  refresh_expires_in?: number;
}

/** Identity service unreachable, as opposed to rejected credentials. */
class ServiceIndisponible extends CredentialsSignin {
  code = "service_indisponible";
}

/**
 * Exchanges username and password for Keycloak tokens.
 *
 * Returns `null` whenever credentials are rejected, whatever the reason, so as not to reveal whether
 * an account exists, is disabled or awaits an action.
 */
async function obtenirJetons(
  identifiant: string,
  motDePasse: string,
): Promise<JetonsKeycloak | null> {
  const env = getEnvServeur();

  let reponse: Response;
  try {
    reponse = await fetch(`${env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.KEYCLOAK_CLIENT_ID,
        client_secret: env.KEYCLOAK_CLIENT_SECRET,
        grant_type: "password",
        scope: "openid",
        username: identifiant,
        password: motDePasse,
      }),
    });
  } catch {
    throw new ServiceIndisponible();
  }

  // 5xx: the service is failing, not the user's credentials.
  if (reponse.status >= 500) throw new ServiceIndisponible();
  if (!reponse.ok) return null;

  return (await reponse.json()) as JetonsKeycloak;
}

/**
 * Qualified refresh failure.
 *
 * `refus`: Keycloak rejected the token (expired or revoked); the session is over and logging in
 * again is the right action. Otherwise Keycloak did not answer or returned a server error: the
 * session is not at fault and asking the user to log in again would be wrong.
 */
class EchecRafraichissement extends Error {
  constructor(
    message: string,
    readonly refus: boolean,
  ) {
    super(message);
  }
}

async function rafraichir(refreshToken: string): Promise<JetonsKeycloak> {
  const env = getEnvServeur();
  let reponse: Response;
  try {
    reponse = await fetch(`${env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.KEYCLOAK_CLIENT_ID,
        client_secret: env.KEYCLOAK_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
  } catch (error_) {
    // No response (network, service down, DNS): the session is not at fault.
    throw new EchecRafraichissement(`Keycloak injoignable : ${String(error_)}`, false);
  }

  if (!reponse.ok) {
    /*
     * 4xx: Keycloak rejected the token (`invalid_grant` when expired or revoked).
     * 5xx: it could not answer; the session is not at fault.
     */
    const refus = reponse.status >= 400 && reponse.status < 500;
    throw new EchecRafraichissement(
      `Rafraîchissement ${refus ? "refusé" : "indisponible"} (HTTP ${reponse.status})`,
      refus,
    );
  }
  return (await reponse.json()) as JetonsKeycloak;
}

/** Decodes a JWT payload without verifying the signature: Keycloak has just issued it. */
function claims(jeton: string): Record<string, unknown> {
  try {
    const charge = jeton.split(".")[1];
    if (!charge) return {};
    return JSON.parse(
      Buffer.from(charge.replaceAll("-", "+").replaceAll("_", "/"), "base64").toString("utf8"),
    ) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * The access token `roles` claim carries realm roles with composites already resolved (e.g.
 * `["ROLE_JURISTE","ROLE_SAISIE","ROLE_CONSULTATION"]`).
 */
function rolesDepuisJeton(accessToken: string): string[] {
  const valeur = claims(accessToken).roles;
  return Array.isArray(valeur) ? valeur.filter((r): r is string => typeof r === "string") : [];
}

function texte(valeur: unknown): string | null {
  return typeof valeur === "string" && valeur.length > 0 ? valeur : null;
}

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: "Afriland",
      credentials: {
        identifiant: { label: "Identifiant", type: "text" },
        motDePasse: { label: "Mot de passe", type: "password" },
      },
      async authorize(donnees) {
        const identifiant =
          typeof donnees?.identifiant === "string" ? donnees.identifiant.trim() : "";
        const motDePasse = typeof donnees?.motDePasse === "string" ? donnees.motDePasse : "";
        if (!identifiant || !motDePasse) return null;

        const jetons = await obtenirJetons(identifiant, motDePasse);
        if (!jetons) return null;

        const c = claims(jetons.access_token);
        const maintenant = Date.now();

        // Feeds the `jwt` callback on first pass. Never contains the password.
        return {
          id: texte(c.sub) ?? identifiant,
          email: texte(c.email),
          name:
            [texte(c.given_name), texte(c.family_name)].filter(Boolean).join(" ") || identifiant,
          keycloakId: texte(c.sub) ?? undefined,
          nom: texte(c.family_name),
          prenom: texte(c.given_name),
          accessToken: jetons.access_token,
          refreshToken: jetons.refresh_token,
          idToken: jetons.id_token,
          expiresAt: maintenant + jetons.expires_in * 1000,
          refreshExpiresAt: maintenant + (jetons.refresh_expires_in ?? 1800) * 1000,
          roles: rolesDepuisJeton(jetons.access_token),
        };
      },
    }),
  ],
  secret: getEnvServeur().AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      // First login: `user` is the object returned by `authorize`.
      if (user) {
        const u = user as typeof user & {
          keycloakId?: string;
          nom?: string | null;
          prenom?: string | null;
          accessToken?: string;
          refreshToken?: string;
          idToken?: string;
          expiresAt?: number;
          refreshExpiresAt?: number;
          roles?: string[];
        };
        token.accessToken = u.accessToken;
        token.refreshToken = u.refreshToken;
        token.idToken = u.idToken;
        token.expiresAt = u.expiresAt;
        token.refreshExpiresAt = u.refreshExpiresAt;
        token.roles = u.roles ?? [];
        token.keycloakId = u.keycloakId;
        token.nom = u.nom ?? null;
        token.prenom = u.prenom ?? null;
        delete token.erreur;
        return token;
      }

      // Tokens still valid; policy in `lib/rotation-jeton.ts`.
      if (!doitRafraichir(Date.now(), token.expiresAt, token.refreshExpiresAt)) return token;

      if (!token.refreshToken) return { ...token, erreur: ERREUR_RAFRAICHISSEMENT };

      try {
        const jetons = await rafraichir(token.refreshToken);
        const maintenant = Date.now();
        return {
          ...token,
          accessToken: jetons.access_token,
          // Keycloak rotates the refresh token: keeping the old one would doom the session.
          refreshToken: jetons.refresh_token ?? token.refreshToken,
          idToken: jetons.id_token ?? token.idToken,
          expiresAt: maintenant + jetons.expires_in * 1000,
          refreshExpiresAt: maintenant + (jetons.refresh_expires_in ?? 1800) * 1000,
          roles: rolesDepuisJeton(jetons.access_token),
          erreur: undefined,
        };
      } catch (error_) {
        /**
         * Final failure: flag the session instead of looping on 401s; the shell then redirects to
         * login. The flag qualifies the cause: a rejected token is not a service outage, and the
         * user has different things to do in each case.
         */
        const indisponible = error_ instanceof EchecRafraichissement && !error_.refus;
        return { ...token, erreur: indisponible ? ERREUR_AUTH_INDISPONIBLE : ERREUR_RAFRAICHISSEMENT };
      }
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.roles = token.roles ?? [];
      session.erreur = token.erreur;
      /*
       * The browser keeps the token in memory until this deadline instead of re-reading the session
       * on every request. Computed here with the rotation function so the rule is not duplicated
       * client-side.
       */
      session.rafraichirApres =
        token.expiresAt && token.refreshExpiresAt
          ? prochainRafraichissement(token.expiresAt, token.refreshExpiresAt)
          : undefined;
      if (session.user) {
        session.user.keycloakId = token.keycloakId;
        session.user.nom = token.nom ?? null;
        session.user.prenom = token.prenom ?? null;
      }
      return session;
    },
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
