"use server";

import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";
import { MARQUEUR_DECONNEXION } from "@/lib/marqueur-deconnexion";

/** The action returns a message key, never translated text: the component knows the active language. */
export type CleErreurConnexion =
  | "champsRequis"
  | "identifiantsRefuses"
  | "serviceIndisponible";

export interface EtatConnexion {
  cleErreur?: CleErreurConnexion;
}

/** A text field of the form; a missing field reads as empty. */
function texte(valeur: FormDataEntryValue | null): string {
  return typeof valeur === "string" ? valeur : "";
}

export async function connexion(
  _etat: EtatConnexion | undefined,
  donnees: FormData,
): Promise<EtatConnexion> {
  const identifiant = texte(donnees.get("identifiant")).trim();
  const motDePasse = texte(donnees.get("motDePasse"));

  if (!identifiant || !motDePasse) return { cleErreur: "champsRequis" };

  try {
    /**
     * `redirect: false` is required: otherwise NextAuth redirects to its error page on failure and
     * the state returned by this action is lost.
     */
    await signIn("credentials", { identifiant, motDePasse, redirect: false });
  } catch (error_) {
    if (error_ instanceof AuthError) {
      const code = (error_ as AuthError & { code?: string }).code;
      /**
       * Every rejection gets the same key (unknown, disabled or pending account): distinguishing
       * them would reveal which usernames exist.
       */
      return {
        cleErreur: code === "service_indisponible" ? "serviceIndisponible" : "identifiantsRefuses",
      };
    }
    throw error_;
  }

  /*
   * Logging in clears the logout marker; otherwise the middleware would wipe the new session and
   * logging back in right after a logout would be impossible.
   */
  (await cookies()).delete(MARQUEUR_DECONNEXION);

  /**
   * Outside the `try`: `redirect()` throws an internal Next exception that must not be caught as a
   * login failure.
   */
  redirect("/");
}
