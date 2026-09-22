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
 * Authentification par formulaire intégré, adossée à Keycloak.
 *
 * **Décision utilisateur du 2026-09-08 (QF-18)** : le formulaire d'identification vit dans
 * l'application, pour la cohérence visuelle avec les autres applications internes de la banque
 * (GFA). Keycloak reste le seul détenteur des identités et le seul émetteur de jetons — il valide
 * les credentials via le flux « mot de passe » (`grant_type=password`, `directAccessGrantsEnabled`
 * déjà actif sur le client `audiences-api`).
 *
 * **Le mot de passe ne quitte jamais le serveur** : `authorize` s'exécute côté Next.js. Il ne
 * figure ni dans le paquet navigateur, ni dans la session, ni dans aucun journal.
 *
 * Limites assumées, consignées en QF-18 : ce flux ne prend en charge ni second facteur, ni
 * réinitialisation de mot de passe, ni connexion unique inter-applications. Si la DSI active l'un
 * d'eux sur le realm, ce chemin devra être repris.
 */

interface JetonsKeycloak {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
  refresh_expires_in?: number;
}

/** Le service d'identité est injoignable — à distinguer d'un refus d'identifiants. */
class ServiceIndisponible extends CredentialsSignin {
  code = "service_indisponible";
}

/**
 * Échange identifiant + mot de passe contre des jetons auprès de Keycloak.
 *
 * Renvoie `null` si les identifiants sont refusés, **quelle qu'en soit la raison précise** : ne pas
 * révéler si un compte existe, est désactivé ou attend une action.
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

  // 5xx : le service est en défaut, ce n'est pas la faute de l'utilisateur — le distinguer.
  if (reponse.status >= 500) throw new ServiceIndisponible();
  if (!reponse.ok) return null;

  return (await reponse.json()) as JetonsKeycloak;
}

/**
 * Échec de rafraîchissement, **qualifié**.
 *
 * `refus` : Keycloak a répondu et a rejeté le jeton — il est expiré ou révoqué. La session est bien
 * terminée, se reconnecter est la bonne action.
 *
 * Sinon : Keycloak n'a pas répondu, ou a répondu par une erreur serveur. La session n'est pas en
 * cause, et demander à l'utilisateur de se reconnecter serait doublement faux — le diagnostic et la
 * consigne, puisque la connexion passe par ce même service.
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
  } catch (cause) {
    // Aucune réponse : réseau coupé, service arrêté, DNS. Ce n'est pas la session qui est en cause.
    throw new EchecRafraichissement(`Keycloak injoignable : ${String(cause)}`, false);
  }

  if (!reponse.ok) {
    /*
     * 4xx : Keycloak a examiné le jeton et l'a rejeté — `invalid_grant` quand il est expiré ou
     * révoqué. 5xx : il n'a pas pu répondre, la session n'y est pour rien.
     */
    const refus = reponse.status >= 400 && reponse.status < 500;
    throw new EchecRafraichissement(
      `Rafraîchissement ${refus ? "refusé" : "indisponible"} (HTTP ${reponse.status})`,
      refus,
    );
  }
  return (await reponse.json()) as JetonsKeycloak;
}

/** Décode la charge utile d'un JWT sans en vérifier la signature — Keycloak vient de l'émettre. */
function claims(jeton: string): Record<string, unknown> {
  try {
    const charge = jeton.split(".")[1];
    if (!charge) return {};
    return JSON.parse(
      Buffer.from(charge.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Le claim `roles` du jeton d'accès porte les rôles du realm, **composites déjà résolus** — vérifié
 * en réel : `juriste.test` reçoit `["ROLE_JURISTE","ROLE_SAISIE","ROLE_CONSULTATION"]`.
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

        // Alimente le callback `jwt` au premier passage. Ne contient évidemment pas le mot de passe.
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
      // Première connexion : `user` est l'objet renvoyé par `authorize`.
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

      // Jetons encore valides — politique dans `lib/rotation-jeton.ts`.
      if (!doitRafraichir(Date.now(), token.expiresAt, token.refreshExpiresAt)) return token;

      if (!token.refreshToken) return { ...token, erreur: ERREUR_RAFRAICHISSEMENT };

      try {
        const jetons = await rafraichir(token.refreshToken);
        const maintenant = Date.now();
        return {
          ...token,
          accessToken: jetons.access_token,
          // Keycloak fait tourner le refresh token : conserver l'ancien condamnerait la session.
          refreshToken: jetons.refresh_token ?? token.refreshToken,
          idToken: jetons.id_token ?? token.idToken,
          expiresAt: maintenant + jetons.expires_in * 1000,
          refreshExpiresAt: maintenant + (jetons.refresh_expires_in ?? 1800) * 1000,
          roles: rolesDepuisJeton(jetons.access_token),
          erreur: undefined,
        };
      } catch (echec) {
        /**
         * Échec définitif : on marque la session plutôt que de boucler sur des 401. La coquille
         * redirige alors vers la connexion — une déconnexion nette vaut mieux qu'une interface qui
         * refuse silencieusement chaque appel.
         *
         * Le marqueur **qualifie** la cause depuis 2026-09-16 : un jeton rejeté n'est pas un service
         * à terre, et l'utilisateur n'a pas la même chose à faire dans les deux cas.
         */
        const indisponible = echec instanceof EchecRafraichissement && !echec.refus;
        return { ...token, erreur: indisponible ? ERREUR_AUTH_INDISPONIBLE : ERREUR_RAFRAICHISSEMENT };
      }
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.roles = token.roles ?? [];
      session.erreur = token.erreur;
      /*
       * QF-42 : le navigateur garde le jeton en mémoire jusqu'à cette échéance au lieu de relire la
       * session à chaque requête. La fenêtre est calculée ici, par la même fonction que la rotation
       * — dupliquer la règle côté client rouvrirait RF-02.
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
