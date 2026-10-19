/**
 * Period shortcuts for the audit screen.
 *
 * Client-side input helpers only: the API takes a free interval, which these functions pre-fill.
 * Each shortcut covers the elapsed period, inclusive, and ends today: an archive must not claim to
 * cover days still to come.
 */

export type RaccourciPeriode = "jour" | "semaine" | "mois" | "trimestre" | "semestre" | "annee";

export const RACCOURCIS_PERIODE: readonly RaccourciPeriode[] = [
  "jour",
  "semaine",
  "mois",
  "trimestre",
  "semestre",
  "annee",
] as const;

export interface Periode {
  debut: string;
  fin: string;
}

/** ISO `YYYY-MM-DD`, as expected by the backend. */
function iso(date: Date): string {
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mois}-${jour}`;
}

/**
 * Current period for a shortcut, starting at the beginning of the current calendar unit (month,
 * quarter, half-year, year), not a count of days back. Weeks start on Monday (`getDay()` returns 0
 * for Sunday, mapped to 6).
 */
export function periodeDe(raccourci: RaccourciPeriode, aujourdHui = new Date()): Periode {
  const fin = new Date(aujourdHui.getFullYear(), aujourdHui.getMonth(), aujourdHui.getDate());
  const debut = new Date(fin);

  switch (raccourci) {
    case "jour":
      break;
    case "semaine": {
      const jour = (fin.getDay() + 6) % 7;
      debut.setDate(fin.getDate() - jour);
      break;
    }
    case "mois":
      debut.setDate(1);
      break;
    case "trimestre":
      debut.setMonth(Math.floor(fin.getMonth() / 3) * 3, 1);
      break;
    case "semestre":
      debut.setMonth(fin.getMonth() < 6 ? 0 : 6, 1);
      break;
    case "annee":
      debut.setMonth(0, 1);
      break;
  }

  return { debut: iso(debut), fin: iso(fin) };
}
