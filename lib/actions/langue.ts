"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { COOKIE_LANGUE, estLangue } from "@/i18n/config";

const UN_AN = 60 * 60 * 24 * 365;

/**
 * Enregistre la langue choisie dans un cookie.
 *
 * La préférence est donc **propre à chaque navigateur** : un utilisateur changeant de poste
 * retrouve le français par défaut. Rattacher la préférence au compte supposerait une colonne
 * `langue` côté backend — décision reportée (QF-09b).
 */
export async function changerLangue(donnees: FormData) {
  const valeur = donnees.get("langue");
  if (!estLangue(valeur)) return;

  (await cookies()).set(COOKIE_LANGUE, valeur, {
    maxAge: UN_AN,
    sameSite: "lax",
    path: "/",
  });

  revalidatePath("/", "layout");
}
