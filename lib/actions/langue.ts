"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { COOKIE_LANGUE, estLangue } from "@/i18n/config";

const UN_AN = 60 * 60 * 24 * 365;

/**
 * Stores the chosen language in a cookie, so the preference is per browser: on another machine
 * the user gets French by default.
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
