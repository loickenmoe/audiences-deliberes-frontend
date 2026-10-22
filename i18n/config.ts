/**
 * French / English, the two official languages of Cameroon.
 *
 * No language prefix in URLs: notification links point to specific case files and must stay valid
 * across users whatever their language. The preference lives in a cookie.
 */
export const LANGUES = ["fr", "en"] as const;
export type Langue = (typeof LANGUES)[number];

export const LANGUE_PAR_DEFAUT: Langue = "fr";

/** Preference cookie name, readable both server-side and in the browser. */
export const COOKIE_LANGUE = "langue";

export function estLangue(valeur: unknown): valeur is Langue {
  return typeof valeur === "string" && (LANGUES as readonly string[]).includes(valeur);
}

/** Full `Intl` locale: dates, numbers and amounts follow the chosen language. */
export const LOCALE_INTL: Record<Langue, string> = {
  fr: "fr-CM",
  en: "en-CM",
};
