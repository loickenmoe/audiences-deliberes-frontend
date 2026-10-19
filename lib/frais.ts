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
  /** `null`: all requests. */
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
 * The queue opens on what awaits the user; the profile picks the relevant statuses. The Assistant
 * checks compliance then records payment; the DJA checks appropriateness then votes jointly; the DJ
 * only votes jointly. A lawyer only sees their own requests, all at once.
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

/** Joint approval step held by this profile; the DJ and the DJA each cast their own (US 4.5). */
export function etapeConjointeDe(roles: readonly string[] | undefined): EtapeValidationFrais | null {
  const profil = profilPrincipal(roles);
  if (profil === "ROLE_DJ") return "CONJOINTE_DJ";
  if (profil === "ROLE_DJA") return "CONJOINTE_DJA";
  return null;
}

/** True if this profile already voted on the joint approval; the backend rejects a second vote. */
export function aDonneSonAccord(demande: DemandeFrais, roles: readonly string[] | undefined): boolean {
  const etape = etapeConjointeDe(roles);
  return etape !== null && demande.validations.some((v) => v.etape === etape);
}
