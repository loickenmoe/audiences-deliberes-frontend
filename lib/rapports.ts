import { ajouterJours, ajouterMois, versIso } from "@/lib/calendrier";
import type { PeriodeRapport } from "@/services/reportingService";
import type { TypeRapport } from "@/types/enums";

/**
 * Default bounds of an activity report.
 *
 * On the backend `type` is only a label; `dateDebut` and `dateFin` bound the computation. The screen
 * proposes bounds consistent with the chosen type, which the user may adjust. Periods end today and
 * go back in time, computed in local dates (`toISOString()` could shift the date by one day).
 */
export function periodeParDefaut(type: TypeRapport, fin: Date = new Date()): PeriodeRapport {
  return { type, dateDebut: versIso(debutSelonType(type, fin)), dateFin: versIso(fin) };
}

function debutSelonType(type: TypeRapport, fin: Date): Date {
  switch (type) {
    case "JOURNALIER":
      return fin;
    case "HEBDOMADAIRE":
      return ajouterJours(fin, -6); // today included: seven days in total
    case "MENSUEL":
      return ajouterMois(fin, -1);
    case "TRIMESTRIEL":
      return ajouterMois(fin, -3);
    case "ANNUEL":
      return ajouterMois(fin, -12);
  }
}

/** An inverted period would return nothing: better to say so before the call than get a 204. */
export function periodeValide(periode: PeriodeRapport): boolean {
  return periode.dateDebut !== "" && periode.dateFin !== "" && periode.dateDebut <= periode.dateFin;
}

/** Binary format extensions: the `Content-Disposition` header is not exposed through CORS. */
export const EXTENSION_RAPPORT = { PDF: "pdf", EXCEL: "xlsx", CSV: "csv" } as const;

/** Dated file name, so archived reports can be told apart. */
export function nomFichierRapport(periode: PeriodeRapport, format: keyof typeof EXTENSION_RAPPORT): string {
  /*
   * The category scope is part of the name when set: a single-category report and an all-category
   * report show different figures for the same period.
   */
  const perimetre = periode.categorie === undefined ? "" : `-${periode.categorie.toLowerCase()}`;
  return `rapport-${periode.type.toLowerCase()}${perimetre}-${periode.dateDebut}_${periode.dateFin}.${EXTENSION_RAPPORT[format]}`;
}

/**
 * File name of a downloaded activity sheet.
 *
 * Deliberately mirrors the server rule (`RapportActiviteExportService.nomFichier`): CORS does not
 * expose `Content-Disposition`, so the browser cannot read the server's name. A unit test keeps both
 * rules aligned. Accents are stripped before lowercasing so they do not fall outside `[a-z0-9]`.
 */
export function nomFichierActivite(
  personne: { nom: string | null; utilisateurId: number },
  dateDebut: string,
  dateFin: string,
  format: keyof typeof EXTENSION_RAPPORT,
): string {
  const qui =
    personne.nom === null
      ? String(personne.utilisateurId)
      : personne.nom
          .normalize("NFD")
          .replaceAll(/\p{M}+/gu, "")
          .toLowerCase()
          .replaceAll(/[^a-z0-9]+/g, "-")
          .replace(/^-/, "")
          .replace(/-$/, "");
  return `activite-${qui}-${dateDebut}_${dateFin}.${EXTENSION_RAPPORT[format]}`;
}
