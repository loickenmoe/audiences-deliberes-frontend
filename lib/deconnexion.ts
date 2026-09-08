"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/lib/auth";
import { getEnvServeur } from "@/lib/env.server";

/**
 * Déconnexion complète : session applicative **et** session Keycloak.
 *
 * `signOut()` seul n'efface que le cookie de l'application. La session de connexion unique reste
 * ouverte côté Keycloak : sur un poste partagé, la personne suivante qui clique « Se connecter »
 * serait reconnectée **silencieusement sous l'identité précédente**, sans saisir de mot de passe.
 * Inacceptable pour une application manipulant des dossiers contentieux.
 *
 * On enchaîne donc sur le point de terminaison de déconnexion OIDC du realm, avec `id_token_hint`
 * pour éviter la page de confirmation de Keycloak.
 */
export async function deconnexion() {
  const session = await auth();
  const idToken = session?.idToken;

  await signOut({ redirect: false });

  const env = getEnvServeur();
  const entetes = await headers();
  const origine =
    entetes.get("origin") ??
    `${entetes.get("x-forwarded-proto") ?? "http"}://${entetes.get("host") ?? "localhost:3000"}`;

  const url = new URL(`${env.KEYCLOAK_ISSUER}/protocol/openid-connect/logout`);
  url.searchParams.set("post_logout_redirect_uri", `${origine}/login`);
  if (idToken) {
    url.searchParams.set("id_token_hint", idToken);
  } else {
    // Sans `id_token_hint`, Keycloak exige `client_id` et affiche un écran de confirmation.
    url.searchParams.set("client_id", env.KEYCLOAK_CLIENT_ID);
  }

  redirect(url.toString());
}
