import type { TonStatut } from "@/components/global/statut-chip";
import { profilPrincipal } from "@/lib/rbac";
import type { DemandeFrais } from "@/types/domaine";
import type { EtapeValidationFrais, StatutCircuitFrais } from "@/types/enums";

export const TON_STATUT_FRAIS: Record<StatutCircuitFrais, TonStatut> = {
  DEPOSEE: "info",
  CONFORMITE: "attention",
  OPPORTUNITE: "attention",
  VALIDEE: "succes",
  REJETEE: "danger",
  PAYEE: "neutre",
};

export type CleVueFrais = "aControler" | "aPayer" | "opportunite" | "conjointe" | "toutes";

export interface VueFrais {
  cle: CleVueFrais;
  /** `null` : toutes les demandes. */
  statut: StatutCircuitFrais | null;
}

const VUES: Record<CleVueFrais, VueFrais> = {
  aControler: { cle: "aControler", statut: "DEPOSEE" },
  aPayer: { cle: "aPayer", statut: "VALIDEE" },
  opportunite: { cle: "opportunite", statut: "CONFORMITE" },
  conjointe: { cle: "conjointe", statut: "OPPORTUNITE" },
  toutes: { cle: "toutes", statut: null },
};

/**
 * La file s'ouvre sur **ce qui attend l'utilisateur** : le backend la sert transverse au personnel
 * interne, filtrée par statut — c'est le profil qui choisit les statuts utiles. L'Assistante contrôle
 * la conformité puis enregistre le paiement ; la DJA contrôle l'opportunité puis vote conjointement ;
 * le DJ ne vote que conjointement. L'avocat ne voit que ses propres demandes, toutes à la fois.
 */
export function vuesFrais(roles: readonly string[] | undefined): [VueFrais, ...VueFrais[]] {
  switch (profilPrincipal(roles)) {
    case "ROLE_ASSISTANTE":
      return [VUES.aControler, VUES.aPayer, VUES.toutes];
    case "ROLE_DJA":
      return [VUES.opportunite, VUES.conjointe, VUES.toutes];
    case "ROLE_DJ":
      return [VUES.conjointe, VUES.toutes];
    default:
      return [VUES.toutes];
  }
}

/** L'accord conjoint que porte ce profil — le DJ et la DJA votent chacun le leur (US 4.5). */
export function etapeConjointeDe(roles: readonly string[] | undefined): EtapeValidationFrais | null {
  const profil = profilPrincipal(roles);
  if (profil === "ROLE_DJ") return "CONJOINTE_DJ";
  if (profil === "ROLE_DJA") return "CONJOINTE_DJA";
  return null;
}

/** Vrai si ce profil a déjà voté sur la validation conjointe : le backend refuserait un second vote. */
export function aDonneSonAccord(demande: DemandeFrais, roles: readonly string[] | undefined): boolean {
  const etape = etapeConjointeDe(roles);
  return etape !== null && demande.validations.some((v) => v.etape === etape);
}
