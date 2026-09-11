import { apiClient } from "@/lib/api/client";
import type { AvocatRepertoire, DemandeConstitution } from "@/types/domaine";
import type { StatutConstitution } from "@/types/enums";

/** Signature, ou rejet toujours motivé (RG-INT-08). */
export type DecisionConstitution = { decision: "VALIDEE" } | { decision: "REJETEE"; motifRejet: string };

/** Constitutions de prestataires (#35, #36, #60) et répertoire des avocats (#37). */
export const constitutionService = {
  /** #60 — `EN_ATTENTE` en ordre d'arrivée (la file du SH) ; sans filtre, l'historique, le plus récent d'abord. */
  lister: async (statut: StatutConstitution | null): Promise<DemandeConstitution[]> => {
    const { data } = await apiClient.get<DemandeConstitution[]>("/constitutions/prestataires", {
      params: statut ? { statut } : {},
    });
    return data;
  },

  /** #35 — juriste : motif obligatoire ; les SH sont notifiés. */
  solliciter: async (demande: { dossierId: number; prestataireId: number; motif: string }): Promise<DemandeConstitution> => {
    const { data } = await apiClient.post<DemandeConstitution>("/constitutions/prestataires", demande);
    return data;
  },

  /**
   * #36 — SH : la signature génère la lettre de constitution et la dépose dans la GED du dossier ;
   * un rejet motivé revient au juriste. 409 si la demande est déjà traitée.
   */
  decider: async (id: number, decision: DecisionConstitution): Promise<DemandeConstitution> => {
    const { data } = await apiClient.put<DemandeConstitution>(`/constitutions/prestataires/${id}/validation`, decision);
    return data;
  },

  /** #37 — répertoire, trié par charge croissante ; recherche par nom côté serveur. */
  repertoire: async (nom?: string): Promise<AvocatRepertoire[]> => {
    const { data } = await apiClient.get<AvocatRepertoire[]>("/repertoire/avocats", {
      params: nom ? { nom } : {},
    });
    return data;
  },
};
