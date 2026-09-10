import { apiClient } from "@/lib/api/client";
import type { DocumentDossier } from "@/types/domaine";

/**
 * GED — lecture seule à ce stade. Le dépôt, la suppression et son circuit de validation arrivent
 * avec le module GED.
 */
export const gedService = {
  /**
   * #43 — documents d'un dossier.
   *
   * C'est la **seule** source fiable : `DossierResponse.documents` est vide par construction
   * (Q-67 backend), et le type `Dossier` ne le déclare d'ailleurs pas.
   */
  listerDocumentsDossier: async (dossierId: number): Promise<DocumentDossier[]> => {
    const { data } = await apiClient.get<DocumentDossier[]>(`/dossiers/${dossierId}/documents`);
    return data;
  },
};
