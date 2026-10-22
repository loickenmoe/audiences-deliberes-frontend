import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { LOCALE_INTL, type Langue } from "@/i18n/config";

/** Merges Tailwind classes, resolving conflicts (shadcn/ui convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SANS_VALEUR = "—";

/** Formats an amount in CFA francs. Domain amounts are always whole numbers: no decimals. */
export function formaterFcfa(montant: number | null | undefined, langue: Langue = "fr"): string {
  if (montant === null || montant === undefined || Number.isNaN(montant)) return SANS_VALEUR;
  return new Intl.NumberFormat(LOCALE_INTL[langue], {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(montant);
}

/** Formats an ISO `YYYY-MM-DD` date returned by the backend. */
export function formaterDate(iso: string | null | undefined, langue: Langue = "fr"): string {
  const date = enDate(iso);
  if (!date) return SANS_VALEUR;
  return new Intl.DateTimeFormat(LOCALE_INTL[langue], { dateStyle: "long" }).format(date);
}

/** Formats an ISO timestamp, for history and action logs. */
export function formaterDateHeure(iso: string | null | undefined, langue: Langue = "fr"): string {
  const date = enDate(iso);
  if (!date) return SANS_VALEUR;
  return new Intl.DateTimeFormat(LOCALE_INTL[langue], {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

/** Formats a file size. The DMS limit is 10 MB (RG-GED-08). */
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
 * Parses a backend date value.
 *
 * A date-only value (`LocalDate`: `2026-09-10`) must be read in local time: `new Date(iso)` treats it
 * as UTC midnight, showing the previous day west of Greenwich. Timestamps (`LocalDateTime`, no zone)
 * are already read in local time.
 */
function enDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const jourSeul = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const date = jourSeul
    ? new Date(Number(jourSeul[1]), Number(jourSeul[2]) - 1, Number(jourSeul[3]))
    : new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}
