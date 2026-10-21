import type { ConfigurationSysteme, LigneCanalNotification } from "@/types/domaine";

/**
 * External notification settings.
 *
 * Two audiences, each with its channel switch and grid:
 * - internal users: Outlook and Teams, switch `CANAUX_NOTIFICATION_DEFAUT`;
 * - external providers: personal email, SMS and WhatsApp, switch `CANAUX_NOTIFICATION_PRESTATAIRES`.
 *
 * A grid column is a configuration key listing the events sent on that channel. Rows come from the
 * accepted values published by the backend.
 */
export interface SectionGrille {
  identifiant: "internes" | "prestataires";
  /** Key enabling or disabling this audience's channels. */
  cleCanaux: string;
  colonnes: { cle: string; canal: string }[];
}

export const SECTIONS_GRILLE: SectionGrille[] = [
  {
    identifiant: "internes",
    cleCanaux: "CANAUX_NOTIFICATION_DEFAUT",
    colonnes: [
      { cle: "GRILLE_NOTIFICATION_OUTLOOK", canal: "OUTLOOK" },
      { cle: "GRILLE_NOTIFICATION_TEAMS", canal: "TEAMS" },
    ],
  },
  {
    identifiant: "prestataires",
    cleCanaux: "CANAUX_NOTIFICATION_PRESTATAIRES",
    colonnes: [
      { cle: "GRILLE_NOTIFICATION_COURRIEL_PERSONNEL", canal: "COURRIEL_PERSONNEL" },
      { cle: "GRILLE_NOTIFICATION_SMS", canal: "SMS" },
      { cle: "GRILLE_NOTIFICATION_WHATSAPP", canal: "WHATSAPP" },
    ],
  },
];

/** Grid columns are shown in the grid, not in the generic settings list. */
export function estCleDeGrille(cle: string): boolean {
  return cle.startsWith("GRILLE_NOTIFICATION_");
}

/** Keys whose values are channels: their checkboxes show a translated label, not a code. */
export const CLES_CANAUX: Record<string, "CanalAlerte" | "CanalPrestataire"> = {
  CANAUX_NOTIFICATION_DEFAUT: "CanalAlerte",
  CANAUX_NOTIFICATION_PRESTATAIRES: "CanalPrestataire",
};

/** Normalized items of an `A,B,C` list; an empty list yields an empty array. */
export function lireListe(valeur: string): string[] {
  return valeur
    .split(",")
    .map((element) => element.trim().toUpperCase())
    .filter((element) => element !== "");
}

/** Section input state: checked events per column key. */
export type SaisieGrille = Record<string, string[]>;

export function saisieInitiale(section: SectionGrille, configurations: ConfigurationSysteme[]): SaisieGrille {
  return Object.fromEntries(
    section.colonnes.map(({ cle }) => [cle, lireListe(trouver(configurations, cle)?.valeur ?? "")]),
  );
}

/** Toggles an event in a column, keeping the order published by the backend. */
export function basculerCase(
  saisie: SaisieGrille,
  cle: string,
  evenement: string,
  ordre: string[],
): SaisieGrille {
  const courants = new Set(saisie[cle] ?? []);
  if (courants.has(evenement)) courants.delete(evenement);
  else courants.add(evenement);
  return { ...saisie, [cle]: ordre.filter((element) => courants.has(element)) };
}

/**
 * Modified columns with the value to send. Only these are sent: each saved key leaves an audit
 * trail entry.
 */
export function colonnesModifiees(
  saisie: SaisieGrille,
  configurations: ConfigurationSysteme[],
): { cle: string; valeur: string }[] {
  return Object.entries(saisie)
    .map(([cle, elements]) => ({ cle, valeur: elements.join(",") }))
    .filter(({ cle, valeur }) => valeur !== lireListe(trouver(configurations, cle)?.valeur ?? "").join(","));
}

/** A channel is active when its audience switch contains it. */
export function canalActif(section: SectionGrille, canal: string, configurations: ConfigurationSysteme[]): boolean {
  return lireListe(trouver(configurations, section.cleCanaux)?.valeur ?? "").includes(canal);
}

export function trouver(configurations: ConfigurationSysteme[], cle: string): ConfigurationSysteme | undefined {
  return configurations.find((configuration) => configuration.cle === cle);
}

/**
 * Phone numbers accepted by the backend (same rule on both sides).
 *
 * Cameroon: exactly nine digits starting with 6, with or without the country code (all mobiles
 * start with 6; landlines start with 2 and receive no SMS). Elsewhere the country code is required.
 */
export function telephoneValide(saisie: string): boolean {
  const numero = saisie.replaceAll(/[\s.()-]/g, "");
  if (numero === "") return true;
  if (/^(\+?237)?6\d{8}$/.test(numero)) return true;
  // A malformed Cameroonian number must not be accepted by the international rule.
  if (numero.startsWith("+237") || numero.startsWith("237")) return false;
  return /^\+[1-9]\d{7,14}$/.test(numero);
}

/** The last thirty days, inclusive, in the ISO format expected by the backend. */
export function fenetreParDefaut(): { debut: string; fin: string } {
  const aujourdHui = new Date();
  const ilYATrenteJours = new Date(aujourdHui.getTime() - 29 * 86_400_000);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { debut: iso(ilYATrenteJours), fin: iso(aujourdHui) };
}

/**
 * Share of messages sent or about to be sent, as a percentage with one decimal.
 *
 * Unreachable rows (missing contact details) are excluded: they flag a record to complete, not a
 * failing channel. A channel with no sends returns `null` rather than a misleading 0 %.
 */
export function tauxAboutissement(ligne: LigneCanalNotification): number | null {
  const total =
    ligne.enAttente + ligne.remises + ligne.confirmees + ligne.echecs + ligne.sansRetour + ligne.nonJoignables;
  const denominateur = total - ligne.nonJoignables;
  if (denominateur === 0) return null;
  return Math.round(((ligne.confirmees + ligne.remises + ligne.enAttente) / denominateur) * 1000) / 10;
}
