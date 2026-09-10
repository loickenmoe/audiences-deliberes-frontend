import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { LOCALE_INTL, type Langue } from "@/i18n/config";

/** Fusionne des classes Tailwind en résolvant les conflits (convention shadcn/ui). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SANS_VALEUR = "—";

/**
 * Formate un montant en francs CFA.
 *
 * Les montants du domaine sont importants — le seuil par défaut de validation conjointe est de
 * 50 000 000 FCFA — et toujours entiers : aucune décimale n'est affichée.
 */
export function formaterFcfa(montant: number | null | undefined, langue: Langue = "fr"): string {
  if (montant === null || montant === undefined || Number.isNaN(montant)) return SANS_VALEUR;
  return new Intl.NumberFormat(LOCALE_INTL[langue], {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(montant);
}

/** Formate une date ISO `YYYY-MM-DD` renvoyée par le backend. */
export function formaterDate(iso: string | null | undefined, langue: Langue = "fr"): string {
  const date = enDate(iso);
  if (!date) return SANS_VALEUR;
  return new Intl.DateTimeFormat(LOCALE_INTL[langue], { dateStyle: "long" }).format(date);
}

/** Formate un horodatage ISO, pour l'historique et les journaux d'action. */
export function formaterDateHeure(iso: string | null | undefined, langue: Langue = "fr"): string {
  const date = enDate(iso);
  if (!date) return SANS_VALEUR;
  return new Intl.DateTimeFormat(LOCALE_INTL[langue], {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

/** Formate un poids de fichier. Le plafond de la GED est de 10 Mo (RG-GED-08). */
export function formaterOctets(octets: number | null | undefined, langue: Langue = "fr"): string {
  if (octets === null || octets === undefined || Number.isNaN(octets)) return SANS_VALEUR;
  const unites = ["o", "ko", "Mo", "Go"];
  let valeur = octets;
  let rang = 0;
  while (valeur >= 1024 && rang < unites.length - 1) {
    valeur /= 1024;
    rang += 1;
  }
  const formate = new Intl.NumberFormat(LOCALE_INTL[langue], {
    maximumFractionDigits: rang === 0 ? 0 : 1,
  }).format(valeur);
  return `${formate} ${unites[rang]}`;
}

/**
 * Lit une valeur de date du backend.
 *
 * Une date **seule** (`LocalDate` : `2026-09-10`) doit être lue en heure locale : `new Date(iso)` la
 * traite comme minuit UTC, ce qui l'affiche la **veille** partout à l'ouest de Greenwich. Invisible
 * à Douala (UTC+1), mais une date d'audience décalée d'un jour n'est pas une imprécision : c'est une
 * audience manquée. Les horodatages (`LocalDateTime`, sans fuseau) sont déjà lus en heure locale.
 */
function enDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const jourSeul = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const date = jourSeul
    ? new Date(Number(jourSeul[1]), Number(jourSeul[2]) - 1, Number(jourSeul[3]))
    : new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}
