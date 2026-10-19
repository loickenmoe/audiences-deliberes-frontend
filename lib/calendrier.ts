import type { PeriodeCalendrier } from "@/types/enums";

/**
 * Period computations for the hearings calendar.
 *
 * Everything uses local dates serialized as `YYYY-MM-DD` without going through UTC:
 * `toISOString()` converts to UTC and could shift the date back by one day.
 */

/** `YYYY-MM-DD` of a local date. */
export function versIso(date: Date): string {
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mois}-${jour}`;
}

/** Local date from a `YYYY-MM-DD`. */
export function depuisIso(iso: string): Date {
  const [annee, mois, jour] = iso.split("-").map(Number);
  return new Date(annee!, mois! - 1, jour!);
}

export function ajouterJours(date: Date, jours: number): Date {
  const resultat = new Date(date);
  resultat.setDate(resultat.getDate() + jours);
  return resultat;
}

export function ajouterMois(date: Date, mois: number): Date {
  const resultat = new Date(date.getFullYear(), date.getMonth() + mois, 1);
  // Keep the day when it exists in the target month (Jan 31 + 1 month -> Feb 28/29).
  const dernierJour = new Date(resultat.getFullYear(), resultat.getMonth() + 1, 0).getDate();
  resultat.setDate(Math.min(date.getDate(), dernierJour));
  return resultat;
}

/**
 * First day of the period containing `date`: Monday for a week, the 1st for a month, the 1st of the
 * calendar quarter for a quarter.
 */
export function debutDePeriode(periode: PeriodeCalendrier, date: Date): Date {
  if (periode === "HEBDOMADAIRE") {
    const decalage = (date.getDay() + 6) % 7; // Monday = 0
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() - decalage);
  }
  if (periode === "MENSUELLE") return new Date(date.getFullYear(), date.getMonth(), 1);
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}

/** Next (`sens = 1`) or previous (`sens = -1`) period. */
export function decalerPeriode(periode: PeriodeCalendrier, debut: Date, sens: 1 | -1): Date {
  if (periode === "HEBDOMADAIRE") return ajouterJours(debut, 7 * sens);
  return ajouterMois(debut, (periode === "MENSUELLE" ? 1 : 3) * sens);
}

/**
 * Last displayed day of the period: the day before the next period. Must stay aligned with the
 * backend `PeriodeCalendrier` (inclusive `BETWEEN`) so the screen matches the PDF/Excel export.
 */
export function finDePeriode(periode: PeriodeCalendrier, debut: Date): Date {
  if (periode === "HEBDOMADAIRE") return ajouterJours(debut, 6);
  return ajouterJours(ajouterMois(debut, periode === "MENSUELLE" ? 1 : 3), -1);
}

/** Today, as local `YYYY-MM-DD`. */
export function aujourdhui(): string {
  return versIso(new Date());
}

/** Tomorrow, as local `YYYY-MM-DD`; bound used outside hearing scheduling (RG-AUD-08). */
export function demain(): string {
  return versIso(ajouterJours(new Date(), 1));
}

/** Now, in `datetime-local` input format (`YYYY-MM-DDTHH:mm`). */
export function maintenantLocal(): string {
  const date = new Date();
  const heures = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${versIso(date)}T${heures}:${minutes}`;
}
