import type { TonStatut } from "@/components/global/statut-chip";
import { peut, profilPrincipal } from "@/lib/rbac";
import type { StatutConstitution, StatutPublication } from "@/types/enums";

export const TON_STATUT_PUBLICATION: Record<StatutPublication, TonStatut> = {
  DEPOSE: "attention",
  VALIDE: "succes",
  REJETE: "danger",
};

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
 * L'Assistante instruit les publications : sa file s'ouvre sur celles à valider, et elle voit aussi
 * les rejetées. Les juristes, le DJ et la DJA ne lisent que les publications validées — une
 * publication déposée ou rejetée leur répond 404 (US 5.4).
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
  return [{ cle: "validees", statut: "VALIDE" }];
}

/** Le DJ et la DJA centralisent les échanges avec l'avocat (RG-INT-07). */
export function estCentralisateur(roles: readonly string[] | undefined): boolean {
  return peut(roles, "transmettreCorrespondance");
}

/**
 * Un juriste commente pour le DJ/DJA. Depuis Q-81, le DJ et la DJA portent aussi `ROLE_JURISTE` :
 * ils écrivent, eux, la correspondance — commenter pour eux-mêmes n'aurait pas de sens.
 */
export function peutCommenter(roles: readonly string[] | undefined): boolean {
  return peut(roles, "commenterPublication") && !estCentralisateur(roles);
}

export type CleVueConstitutions = "aSigner" | "toutes";

/** Le SH signe : sa file s'ouvre sur les demandes en attente. Le juriste suit l'historique. */
export function vuesConstitutions(roles: readonly string[] | undefined): [CleVueConstitutions, ...CleVueConstitutions[]] {
  return profilPrincipal(roles) === "ROLE_SH" ? ["aSigner", "toutes"] : ["toutes", "aSigner"];
}
