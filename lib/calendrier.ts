import type { PeriodeCalendrier } from "@/types/enums";

/**
 * Calcul des périodes du calendrier des audiences (écran 22).
 *
 * Tout est fait en **dates locales** et sérialisé en `YYYY-MM-DD` sans passer par UTC :
 * `toISOString()` convertit en UTC et ferait reculer la date d'un jour dès que l'heure locale
 * précède minuit UTC. Le projet n'embarque pas de bibliothèque de dates ; ces quelques fonctions
 * suffisent.
 */

/** `YYYY-MM-DD` d'une date locale. */
export function versIso(date: Date): string {
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mois}-${jour}`;
}

/** Date locale d'un `YYYY-MM-DD`. */
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
  // Conserver le jour quand il existe dans le mois cible (31 janvier + 1 mois → 28/29 février).
  const dernierJour = new Date(resultat.getFullYear(), resultat.getMonth() + 1, 0).getDate();
  resultat.setDate(Math.min(date.getDate(), dernierJour));
  return resultat;
}

/**
 * Premier jour de la période contenant `date` : lundi pour une semaine, le 1er pour un mois, le 1er
 * du trimestre civil pour un trimestre. Aligner sur ces bornes rend la navigation prévisible — une
 * « semaine » qui commencerait un jeudi n'aurait pas de sens pour un juriste.
 */
export function debutDePeriode(periode: PeriodeCalendrier, date: Date): Date {
  if (periode === "HEBDOMADAIRE") {
    const decalage = (date.getDay() + 6) % 7; // lundi = 0
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() - decalage);
  }
  if (periode === "MENSUELLE") return new Date(date.getFullYear(), date.getMonth(), 1);
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}

/** Période suivante (`sens = 1`) ou précédente (`sens = -1`). */
export function decalerPeriode(periode: PeriodeCalendrier, debut: Date, sens: 1 | -1): Date {
  if (periode === "HEBDOMADAIRE") return ajouterJours(debut, 7 * sens);
  return ajouterMois(debut, (periode === "MENSUELLE" ? 1 : 3) * sens);
}

/**
 * Dernier jour **affiché** de la période : la veille de la période suivante.
 *
 * Le backend interroge `BETWEEN`, bornes incluses, et sa borne de fin s'arrête désormais elle aussi
 * la veille (QF-31, corrigé) — une semaine commençant un lundi ne ramène plus le lundi suivant.
 * L'écran doit annoncer exactement la période que l'export PDF/Excel contient : les deux calculs
 * restent donc alignés, ici comme dans `PeriodeCalendrier` côté serveur.
 */
export function finDePeriode(periode: PeriodeCalendrier, debut: Date): Date {
  if (periode === "HEBDOMADAIRE") return ajouterJours(debut, 6);
  return ajouterJours(ajouterMois(debut, periode === "MENSUELLE" ? 1 : 3), -1);
}

/** Aujourd'hui, en `YYYY-MM-DD` local. */
export function aujourdhui(): string {
  return versIso(new Date());
}

/** Demain, en `YYYY-MM-DD` local — la date minimale d'une audience (RG-AUD-07). */
export function demain(): string {
  return versIso(ajouterJours(new Date(), 1));
}

/** Maintenant, au format d'un champ `datetime-local` (`YYYY-MM-DDTHH:mm`). */
export function maintenantLocal(): string {
  const date = new Date();
  const heures = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${versIso(date)}T${heures}:${minutes}`;
}
