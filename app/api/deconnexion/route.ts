import { getToken } from "@auth/core/jwt";
import { NextResponse } from "next/server";

import { signOut } from "@/lib/auth";
import { getEnvServeur } from "@/lib/env.server";
import { DUREE_MARQUEUR_S, MARQUEUR_DECONNEXION } from "@/lib/marqueur-deconnexion";

/**
 * Déconnexion.
 *
 * Deux gestes, dans cet ordre :
 * 1. **Révoquer la session côté Keycloak** en lui renvoyant le refresh token. Sans cela, le jeton
 *    resterait valable jusqu'à son expiration (30 minutes) alors que l'utilisateur se croit
 *    déconnecté — quiconque l'aurait intercepté pourrait continuer à obtenir des jetons d'accès.
 * 2. Effacer le cookie de session de l'application.
 * 3. Poser le **marqueur de déconnexion** (QF-42) : effacer le cookie ne suffit pas, une lecture de
 *    session partie juste avant revient juste après et le repose. Le marqueur permet au serveur de
 *    refuser — et d'effacer — toute session qui réapparaîtrait.
 *
 * La révocation se fait **de serveur à serveur**, sans redirection du navigateur : le formulaire
 * d'identification vivant dans l'application (QF-18), le navigateur n'a jamais ouvert de session de
 * connexion unique chez Keycloak. C'est aussi plus robuste — une redirection externe déclenchée
 * depuis Next ne se comporte pas toujours comme attendu.
 *
 * Le refresh token est lu dans le jeton de session brut, jamais exposé à la session côté client.
 *
 * Méthode POST : une déconnexion ne doit pas être déclenchable par un simple lien ou une image
 * distante.
 */
export async function POST(requete: Request) {
  const env = getEnvServeur();

  const jeton = await getToken({
    req: requete,
    secret: env.AUTH_SECRET,
    salt: process.env.NODE_ENV === "production" ? "__Secure-authjs.session-token" : "authjs.session-token",
    secureCookie: process.env.NODE_ENV === "production",
  });

  const refreshToken = typeof jeton?.refreshToken === "string" ? jeton.refreshToken : null;
  if (refreshToken) {
    try {
      await fetch(`${env.KEYCLOAK_ISSUER}/protocol/openid-connect/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env.KEYCLOAK_CLIENT_ID,
          client_secret: env.KEYCLOAK_CLIENT_SECRET,
          refresh_token: refreshToken,
        }),
      });
    } catch {
      // Keycloak injoignable : on déconnecte quand même localement. Le jeton expirera de lui-même.
    }
  }

  await signOut({ redirect: false });

  const origine = new URL(requete.url).origin;
  const reponse = NextResponse.redirect(`${origine}/login`, { status: 303 });
  reponse.cookies.set(MARQUEUR_DECONNEXION, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: DUREE_MARQUEUR_S,
    secure: process.env.NODE_ENV === "production",
  });
  return reponse;
}
