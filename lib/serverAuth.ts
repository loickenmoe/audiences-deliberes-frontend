import "server-only";

import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { auth } from "@/lib/auth";
import { ERREUR_RAFRAICHISSEMENT } from "@/lib/rotation-jeton";
import { type Capacite, peut } from "@/lib/rbac";

/**
 * Garde d'authentification des composants serveur.
 *
 * Une session dont la rotation a échoué est traitée comme absente : mieux vaut une reconnexion
 * franche qu'une interface qui se heurte à des 401 sur chaque appel.
 */
export async function exigerSession(redirection = "/login"): Promise<Session> {
  const session = await auth();

  if (!session?.user || session.erreur === ERREUR_RAFRAICHISSEMENT) {
    redirect(redirection);
  }

  return session;
}

/**
 * Garde d'autorisation. Le backend refuse de toute façon l'appel — cette garde évite d'afficher un
 * écran que l'utilisateur ne pourrait pas utiliser.
 */
export async function exigerCapacite(capacite: Capacite, redirection = "/unauthorized") {
  const session = await exigerSession();

  if (!peut(session.roles, capacite)) {
    redirect(redirection);
  }

  return session;
}
