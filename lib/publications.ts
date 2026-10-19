import type { TonStatut } from "@/components/global/statut-chip";
import { peut, profilPrincipal } from "@/lib/rbac";
import type { StatutConstitution, StatutPublication, TypePublication } from "@/types/enums";

export const TON_STATUT_PUBLICATION: Record<StatutPublication, TonStatut> = {
  DEPOSE: "attention",
  VALIDE: "succes",
  REJETE: "danger",
};

/**
 * Label key of a status, depending on the kind of filing. A hearing report is readable by all as
 * soon as it is filed and the Assistant only acknowledges it (RG-INT-06), so "Validated" does not
 * apply; other publications keep their wording and review.
 */
export function cleStatutPublication(type: TypePublication, statut: StatutPublication): string {
  return `${type === "CR_AUDIENCE" ? "StatutCompteRendu" : "StatutPublication"}.${statut}`;
}

export const TON_STATUT_CONSTITUTION: Record<StatutConstitution, TonStatut> = {
  EN_ATTENTE: "attention",
  VALIDEE: "succes",
  REJETEE: "danger",
};

export type CleVuePublications = "aValider" | "validees" | "rejetees" | "toutes";

export interface VuePublications {
  cle: CleVuePublications;
  statut: StatutPublication | null;
}

/**
 * The Assistant reviews publications: her queue opens on those to process, and she also sees the
 * rejected ones. Other profiles get no filter: per RG-INT-06 the server decides what they see by
 * kind of filing (all hearing reports, other publications once validated).
 */
export function vuesPublications(roles: readonly string[] | undefined): [VuePublications, ...VuePublications[]] {
  if (profilPrincipal(roles) === "ROLE_ASSISTANTE") {
    return [
      { cle: "aValider", statut: "DEPOSE" },
      { cle: "validees", statut: "VALIDE" },
      { cle: "rejetees", statut: "REJETE" },
      { cle: "toutes", statut: null },
    ];
  }
  return [{ cle: "toutes", statut: null }];
}

/** The DJ and the DJA centralize exchanges with the lawyer (RG-INT-07). */
export function estCentralisateur(roles: readonly string[] | undefined): boolean {
  return peut(roles, "transmettreCorrespondance");
}

/**
 * A legal officer comments for the DJ/DJA. The DJ and the DJA also hold `ROLE_JURISTE` but write the
 * correspondence themselves, so commenting for themselves makes no sense.
 */
export function peutCommenter(roles: readonly string[] | undefined): boolean {
  return peut(roles, "commenterPublication") && !estCentralisateur(roles);
}

export type CleVueConstitutions = "aSigner" | "toutes";

/** The SH signs: their queue opens on pending requests. The legal officer follows the history. */
export function vuesConstitutions(roles: readonly string[] | undefined): [CleVueConstitutions, ...CleVueConstitutions[]] {
  return profilPrincipal(roles) === "ROLE_SH" ? ["aSigner", "toutes"] : ["toutes", "aSigner"];
}
