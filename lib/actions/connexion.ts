"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";

/**
 * L'action renvoie une **clé de message**, jamais un texte traduit : la traduction appartient au
 * composant, qui connaît la langue active au moment du rendu.
 */
export type CleErreurConnexion =
  | "champsRequis"
  | "identifiantsRefuses"
  | "serviceIndisponible";

export interface EtatConnexion {
  cleErreur?: CleErreurConnexion;
}

export async function connexion(
  _etat: EtatConnexion | undefined,
  donnees: FormData,
): Promise<EtatConnexion> {
  const identifiant = String(donnees.get("identifiant") ?? "").trim();
  const motDePasse = String(donnees.get("motDePasse") ?? "");

  if (!identifiant || !motDePasse) return { cleErreur: "champsRequis" };

  try {
    /**
     * `redirect: false` est indispensable : avec la redirection intégrée, NextAuth renvoie
     * lui-même vers la page d'erreur en cas d'échec, et l'état retourné par cette action est perdu
     * — l'utilisateur retrouve un formulaire vide, sans explication.
     */
    await signIn("credentials", { identifiant, motDePasse, redirect: false });
  } catch (erreur) {
    if (erreur instanceof AuthError) {
      const code = (erreur as AuthError & { code?: string }).code;
      /**
       * Un refus reçoit **toujours la même clé**, que le compte n'existe pas, soit désactivé ou
       * attende une action : distinguer ces cas révélerait quels identifiants existent.
       */
      return {
        cleErreur: code === "service_indisponible" ? "serviceIndisponible" : "identifiantsRefuses",
      };
    }
    throw erreur;
  }

  /**
   * Hors du `try` : `redirect()` fonctionne en levant une exception interne à Next, qui ne doit
   * surtout pas être interceptée comme un échec de connexion.
   */
  redirect("/");
}
