/**
 * Bilinguisme français / anglais — les deux langues officielles du Cameroun (QF-09, révisé le
 * 2026-09-08 sur décision utilisateur).
 *
 * **Pas de préfixe de langue dans l'URL.** `/dossiers/42` reste `/dossiers/42` quelle que soit la
 * langue : les notifications pointeront vers des dossiers précis, et ces liens doivent rester
 * valables d'un utilisateur à l'autre. La préférence vit dans un cookie (QF-09b).
 */
export const LANGUES = ["fr", "en"] as const;
export type Langue = (typeof LANGUES)[number];

export const LANGUE_PAR_DEFAUT: Langue = "fr";

/** Nom du cookie portant la préférence. Lisible côté serveur comme côté navigateur. */
export const COOKIE_LANGUE = "langue";

export function estLangue(valeur: unknown): valeur is Langue {
  return typeof valeur === "string" && (LANGUES as readonly string[]).includes(valeur);
}

/** Locale complète pour `Intl` : dates, nombres et montants suivent la langue choisie. */
export const LOCALE_INTL: Record<Langue, string> = {
  fr: "fr-CM",
  en: "en-CM",
};
