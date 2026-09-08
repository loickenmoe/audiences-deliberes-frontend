import NextAuth, { type NextAuthConfig } from "next-auth";
import Keycloak from "next-auth/providers/keycloak";

import { getEnvServeur } from "@/lib/env.server";
import { ERREUR_RAFRAICHISSEMENT, doitRafraichir } from "@/lib/rotation-jeton";

/**
 * Authentification déléguée à Keycloak (OIDC, flux Authorization Code).
 *
 * Le backend n'implémente **aucune** gestion de mot de passe : le chemin par identifiants du projet
 * de référence a été supprimé du backend pour raison de sécurité et n'est pas repris ici.
 *
 * Le client `audiences-api` est **confidentiel** : le secret vit côté serveur Next.js, jamais dans
 * le paquet navigateur (QF-05).
 */

interface JetonsKeycloak {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  refresh_expires_in?: number;
}

async function rafraichir(refreshToken: string) {
  const env = getEnvServeur();
  const reponse = await fetch(`${env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.KEYCLOAK_CLIENT_ID,
      client_secret: env.KEYCLOAK_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!reponse.ok) {
    throw new Error(`Rafraîchissement refusé par Keycloak (HTTP ${reponse.status})`);
  }

  return (await reponse.json()) as JetonsKeycloak;
}

/**
 * Le claim `roles` du jeton d'accès porte les rôles du realm, **composites déjà résolus** — vérifié
 * en réel : `juriste.test` reçoit `["ROLE_JURISTE","ROLE_SAISIE","ROLE_CONSULTATION"]`. On lit donc
 * l'access token plutôt que le profil OIDC, qui ne les contient pas.
 */
function rolesDepuisJeton(accessToken: string): string[] {
  try {
    const charge = accessToken.split(".")[1];
    if (!charge) return [];
    const json = Buffer.from(charge.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8",
    );
    const claims = JSON.parse(json) as { roles?: unknown };
    return Array.isArray(claims.roles) ? claims.roles.filter((r): r is string => typeof r === "string") : [];
  } catch {
    return [];
  }
}

export const authConfig: NextAuthConfig = {
  providers: [
    Keycloak({
      clientId: getEnvServeur().KEYCLOAK_CLIENT_ID,
      clientSecret: getEnvServeur().KEYCLOAK_CLIENT_SECRET,
      issuer: getEnvServeur().KEYCLOAK_ISSUER,
    }),
  ],
  secret: getEnvServeur().AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      // Première connexion : on capte les jetons et l'identité.
      if (account?.access_token) {
        const maintenant = Date.now();
        const expiresAt = account.expires_at
          ? account.expires_at * 1000
          : maintenant + (typeof account.expires_in === "number" ? account.expires_in : 3600) * 1000;
        const refreshExpiresIn =
          typeof account.refresh_expires_in === "number" ? account.refresh_expires_in : 1800;

        token.accessToken = account.access_token;
        // Requis par la déconnexion OIDC (`id_token_hint`) — cf. `lib/deconnexion.ts`.
        token.idToken = account.id_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = expiresAt;
        token.refreshExpiresAt = maintenant + refreshExpiresIn * 1000;
        token.roles = rolesDepuisJeton(account.access_token);
        token.keycloakId = (profile?.sub as string | undefined) ?? token.sub;
        token.nom = (profile?.family_name as string | undefined) ?? null;
        token.prenom = (profile?.given_name as string | undefined) ?? null;
        delete token.erreur;
        return token;
      }

      // Jetons encore dans leur fenêtre de validité — politique dans `lib/rotation-jeton.ts`.
      if (!doitRafraichir(Date.now(), token.expiresAt, token.refreshExpiresAt)) {
        return token;
      }

      // Fenêtre dépassée : rotation.
      if (!token.refreshToken) {
        return { ...token, erreur: ERREUR_RAFRAICHISSEMENT };
      }

      try {
        const jetons = await rafraichir(token.refreshToken);
        const maintenant = Date.now();
        return {
          ...token,
          accessToken: jetons.access_token,
          // Keycloak fait tourner le refresh token : conserver l'ancien condamnerait la session.
          refreshToken: jetons.refresh_token ?? token.refreshToken,
          expiresAt: maintenant + jetons.expires_in * 1000,
          refreshExpiresAt: maintenant + (jetons.refresh_expires_in ?? 1800) * 1000,
          roles: rolesDepuisJeton(jetons.access_token),
          erreur: undefined,
        };
      } catch {
        /**
         * Échec définitif : on marque la session plutôt que de boucler sur des 401. La coquille
         * applicative redirige alors vers la connexion — une déconnexion nette vaut mieux qu'une
         * interface qui refuse silencieusement chaque appel.
         */
        return { ...token, erreur: ERREUR_RAFRAICHISSEMENT };
      }
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.idToken = token.idToken;
      session.roles = token.roles ?? [];
      session.erreur = token.erreur;
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
