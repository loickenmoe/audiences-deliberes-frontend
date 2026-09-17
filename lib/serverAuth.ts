import "server-only";

import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { auth } from "@/lib/auth";
import { sessionInutilisable } from "@/lib/rotation-jeton";
import { type Capacite, peut } from "@/lib/rbac";

/**
 * Garde d'authentification des composants serveur.
 *
 * Une session dont la rotation a échoué est traitée comme absente : mieux vaut une reconnexion
 * franche qu'une interface qui se heurte à des 401 sur chaque appel. Les **deux** causes comptent —
 * jeton rejeté ou service injoignable : dans les deux cas la session n'est plus exploitable. Ce qui
 * les sépare n'est pas la conduite à tenir ici, mais ce qu'on **dit** à l'utilisateur.
 */
export async function exigerSession(redirection = "/login"): Promise<Session> {
  const session = await auth();

  if (!session?.user || sessionInutilisable(session.erreur)) {
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
