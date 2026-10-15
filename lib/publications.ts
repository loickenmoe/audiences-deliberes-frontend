import type { TonStatut } from "@/components/global/statut-chip";
import { peut, profilPrincipal } from "@/lib/rbac";
import type { StatutConstitution, StatutPublication, TypePublication } from "@/types/enums";

export const TON_STATUT_PUBLICATION: Record<StatutPublication, TonStatut> = {
  DEPOSE: "attention",
  VALIDE: "succes",
  REJETE: "danger",
};

/**
 * La clé de libellé d'un statut, selon la nature du dépôt.
 *
 * Sur un compte rendu, « Validée » décrirait une autorisation qui n'existe plus : depuis
 * RG-INT-06 amendée (2026-10-05), la pièce est lue de tous dès son dépôt et l'Assistante n'en
 * accuse que réception. Les autres publications gardent leur vocabulaire, et leur contrôle.
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
 * L'Assistante instruit les publications : sa file s'ouvre sur celles à traiter, et elle voit aussi
 * les rejetées.
 *
 * Les autres profils n'ont plus de filtre à proposer : depuis RG-INT-06 amendée (2026-10-05), ce
 * qu'ils voient ne dépend plus d'un statut mais de la nature du dépôt — tous les comptes rendus,
 * et les autres publications une fois validées. C'est le serveur qui le décide ; offrir ici un
 * filtre « Validées » laisserait croire qu'il manque les autres.
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
