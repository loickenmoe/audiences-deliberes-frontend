import type { StatutCycleVie, TypeEtape } from "@/types/enums";

/**
 * Lifecycle transitions accepted by `PATCH /dossiers/{id}/etapes/{etapeId}/statut`.
 *
 * Exact mirror of the backend `EtapeTransitionValidator` (RG-DOS-04), so only allowed transitions
 * are offered instead of an `ERR-004`. The backend remains the authority; keep
 * `transitions.test.ts` in sync with it.
 *
 * Exits from `EN_DELIBERE` go through the deliberations module instead:
 * - `EN_DELIBERE -> DELIBERE_VIDE` when the decision is delivered (`PUT /deliberes/{id}/resultat`),
 *   which collects the result and the deadline;
 * - withdrawal (`EN_DELIBERE -> EN_COURS`, the judge reopens proceedings) has its own endpoint
 *   requiring a reason, and only applies to a pending deliberation.
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
 * `DELIBERE_VIDE -> EN_COURS` through this endpoint means an appeal is lodged: the backend then
 * opens the next stage automatically, which the UI must announce beforehand.
 */
export function estExerciceDeRecours(de: StatutCycleVie, vers: StatutCycleVie): boolean {
  return de === "DELIBERE_VIDE" && vers === "EN_COURS";
}

/** Display order of stages, from first instance to the two cassation courts. */
const ORDRE_ETAPES: readonly TypeEtape[] = ["INSTANCE", "RECOURS_1", "RECOURS_2", "RECOURS_2_CCJA"];

/**
 * Stages the backend also creates on direct positioning (`DossierService.etapesPrecedentes`). A table,
 * not a rank: the CCJA appeal has the same predecessors as the national one (first instance and
 * appeal), not the Supreme Court, since the two cassation courts are alternatives.
 */
const ETAPES_PRECEDENTES: Record<TypeEtape, readonly TypeEtape[]> = {
  INSTANCE: [],
  RECOURS_1: ["INSTANCE"],
  RECOURS_2: ["INSTANCE", "RECOURS_1"],
  RECOURS_2_CCJA: ["INSTANCE", "RECOURS_1"],
};

/**
 * Stages a direct positioning would create in addition to the requested one.
 *
 * Creating `RECOURS_2` on a case file with only its first instance also creates `RECOURS_1`, with
 * status `OUVERTURE` and no detailed history (UC-DOS-04 alt. 3-b). The user must know before
 * confirming.
 */
export function etapesIntermediairesCreees(
  demandee: TypeEtape,
  existantes: readonly TypeEtape[],
): TypeEtape[] {
  return ETAPES_PRECEDENTES[demandee].filter((type) => !existantes.includes(type));
}

/** Stages not yet present on the case file, hence creatable. */
export function etapesCreables(existantes: readonly TypeEtape[]): TypeEtape[] {
  return ORDRE_ETAPES.filter((type) => !existantes.includes(type));
}
