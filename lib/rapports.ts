import { ajouterJours, ajouterMois, versIso } from "@/lib/calendrier";
import type { PeriodeRapport } from "@/services/reportingService";
import type { TypeRapport } from "@/types/enums";

/**
 * Bornes d'un rapport d'activité (écran 40).
 *
 * Côté backend, `type` n'est qu'une **étiquette** : ce sont `dateDebut` et `dateFin` qui bornent le
 * calcul (Q-63). L'écran, lui, doit proposer des bornes cohérentes avec l'étiquette choisie — un
 * rapport « mensuel » couvrant trois jours n'aurait pas de sens pour un juriste. D'où ce calcul
 * côté frontend, que l'utilisateur reste libre d'ajuster ensuite.
 *
 * Les périodes se terminent **aujourd'hui** et remontent dans le temps : on rend compte de ce qui
 * s'est passé, pas de ce qui va se passer. Tout est calculé en dates locales — `toISOString()`
 * ferait reculer la date d'un jour dès que l'heure locale précède minuit UTC.
 */
export function periodeParDefaut(type: TypeRapport, fin: Date = new Date()): PeriodeRapport {
  return { type, dateDebut: versIso(debutSelonType(type, fin)), dateFin: versIso(fin) };
}

function debutSelonType(type: TypeRapport, fin: Date): Date {
  switch (type) {
    case "JOURNALIER":
      return fin;
    case "HEBDOMADAIRE":
      return ajouterJours(fin, -6); // aujourd'hui compris : sept jours au total
    case "MENSUEL":
      return ajouterMois(fin, -1);
    case "TRIMESTRIEL":
      return ajouterMois(fin, -3);
    case "ANNUEL":
      return ajouterMois(fin, -12);
  }
}

/** Une période inversée ne renverrait rien : le dire avant l'appel vaut mieux qu'un 204 trompeur. */
export function periodeValide(periode: PeriodeRapport): boolean {
  return periode.dateDebut !== "" && periode.dateFin !== "" && periode.dateDebut <= periode.dateFin;
}

/** Extensions des formats binaires — l'en-tête `Content-Disposition` n'est pas exposé en CORS. */
export const EXTENSION_RAPPORT = { PDF: "pdf", EXCEL: "xlsx", CSV: "csv" } as const;

/** Nom daté : « rapport.pdf » ne dit rien quand on en archive plusieurs. */
export function nomFichierRapport(periode: PeriodeRapport, format: keyof typeof EXTENSION_RAPPORT): string {
  return `rapport-${periode.type.toLowerCase()}-${periode.dateDebut}_${periode.dateFin}.${EXTENSION_RAPPORT[format]}`;
}
