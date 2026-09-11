import type { StatutCycleVie, TypeEtape } from "@/types/enums";

/**
 * Transitions de cycle de vie acceptées par `PATCH /dossiers/{id}/etapes/{etapeId}/statut`.
 *
 * **Miroir exact** de `EtapeTransitionValidator` côté backend (RG-DOS-04). Il sert à ne proposer
 * que les transitions permises, plutôt que de laisser l'utilisateur choisir un statut pour se voir
 * opposer un `ERR-004`. Le backend reste l'arbitre : si les deux divergent un jour, c'est lui qui a
 * raison, et le test `transitions.test.ts` doit être mis à jour avec lui.
 *
 * Deux absences volontaires — les sorties de « En délibéré » passent par le module délibérés (Q-78) :
 * · `EN_DELIBERE → DELIBERE_VIDE` quand la décision est rendue (`PUT /deliberes/{id}/resultat`,
 *   ou enregistrement direct d'un délibéré déjà rendu), qui collecte le résultat et l'échéance ;
 * · le **rabattement** (`EN_DELIBERE → EN_COURS`, le juge rouvre les débats) a son propre endpoint,
 *   qui exige un motif. Il ne frappe qu'un délibéré en attente, jamais une décision rendue.
 */
const TRANSITIONS_AUTORISEES: Readonly<Record<StatutCycleVie, readonly StatutCycleVie[]>> = {
  OUVERTURE: ["EN_COURS"],
  EN_COURS: ["EN_DELIBERE"],
  EN_DELIBERE: [],
  DELIBERE_VIDE: ["CLOTURE", "EN_COURS"],
  CLOTURE: ["ARCHIVE"],
  ARCHIVE: [],
};

export function transitionsPermises(statut: StatutCycleVie): readonly StatutCycleVie[] {
  return TRANSITIONS_AUTORISEES[statut];
}

/**
 * `DELIBERE_VIDE → EN_COURS` par cet endpoint ne signifie qu'une chose : **un recours est exercé**.
 * Le backend ouvre alors automatiquement l'étape suivante — l'interface doit le dire avant, pas le
 * laisser découvrir après.
 */
export function estExerciceDeRecours(de: StatutCycleVie, vers: StatutCycleVie): boolean {
  return de === "DELIBERE_VIDE" && vers === "EN_COURS";
}

const ORDRE_ETAPES: readonly TypeEtape[] = ["INSTANCE", "RECOURS_1", "RECOURS_2"];

/**
 * Étapes qu'un positionnement direct créerait en plus de celle demandée.
 *
 * Créer `RECOURS_2` sur un dossier qui n'a que son instance crée aussi `RECOURS_1`, au statut
 * `OUVERTURE` et sans historique détaillé (UC-DOS-04 alt. 3-b). L'utilisateur doit le savoir avant
 * de confirmer : ce sont des étapes qu'il n'a pas explicitement demandées.
 */
export function etapesIntermediairesCreees(
  demandee: TypeEtape,
  existantes: readonly TypeEtape[],
): TypeEtape[] {
  const rang = ORDRE_ETAPES.indexOf(demandee);
  return ORDRE_ETAPES.slice(0, rang).filter((type) => !existantes.includes(type));
}

/** Étapes encore absentes du dossier, donc créables. */
export function etapesCreables(existantes: readonly TypeEtape[]): TypeEtape[] {
  return ORDRE_ETAPES.filter((type) => !existantes.includes(type));
}
