import { TAILLE_PAGE } from "@/hooks/const";
import { apiClient, type PageReponse } from "@/lib/api/client";
import type { DemandeFrais, DeposerFrais } from "@/types/domaine";
import type { StatutCircuitFrais } from "@/types/enums";

/** An approval, or a refusal that always carries a reason (RG-INT-03). */
export type DecisionFrais = { accord: true } | { accord: false; motifRejet: string };

function corps(decision: DecisionFrais) {
  return decision.accord ? {} : { motifRejet: decision.motifRejet };
}

/**
 * Lawyer fees workflow (#23 to #28). The backend enforces everything: expected status at each step
 * (409), mandatory rejection reason (400), no double vote (409), payment only for a validated
 * request (400).
 */
export const fraisService = {
  /** #28: work queue, most recent first. All requests for internal staff; a lawyer sees only theirs. */
  lister: async (statut: StatutCircuitFrais | null, page = 0, size = TAILLE_PAGE): Promise<PageReponse<DemandeFrais>> => {
    const { data } = await apiClient.get<PageReponse<DemandeFrais>>("/frais/demandes", {
      params: { statut: statut ?? undefined, page, size },
    });
    return data;
  },

  /** Detail and workflow decisions; a lawyer can only read their own (403 otherwise). */
  consulter: async (id: number): Promise<DemandeFrais> => {
    const { data } = await apiClient.get<DemandeFrais>(`/frais/demandes/${id}`);
    return data;
  },

  /** #24: assistant, request in `DEPOSEE`. If compliant, it moves to the DJA. */
  controlerConformite: async (id: number, decision: DecisionFrais): Promise<DemandeFrais> => {
    const { data } = await apiClient.put<DemandeFrais>(`/frais/demandes/${id}/conformite`, {
      conforme: decision.accord,
      ...corps(decision),
    });
    return data;
  },

  /**
   * #25: DJA, request in `CONFORMITE`. Approval validates it, unless the case is sensitive or the
   * amount exceeds the threshold, in which case it goes to joint validation (`OPPORTUNITE`).
   */
  controlerOpportunite: async (id: number, decision: DecisionFrais): Promise<DemandeFrais> => {
    const { data } = await apiClient.put<DemandeFrais>(`/frais/demandes/${id}/opportunite`, {
      accord: decision.accord,
      ...corps(decision),
    });
    return data;
  },

  /** #26: DJ and DJA each vote; both approvals validate, a single refusal rejects. */
  validerConjointement: async (id: number, decision: DecisionFrais): Promise<DemandeFrais> => {
    const { data } = await apiClient.post<DemandeFrais>(`/frais/demandes/${id}/validation-conjointe`, {
      accord: decision.accord,
      ...corps(decision),
    });
    return data;
  },

  /**
   * #23: the lawyer submits a request (US 4.1, screen 30). `referenceFacture` must be unique: a
   * duplicate returns 409 `ERR-006` on that field. `piecesJustificatives` is a list of names, not
   * files: no document is uploaded here.
   */
  deposer: async (demande: DeposerFrais): Promise<DemandeFrais> => {
    const { data } = await apiClient.post<DemandeFrais>("/frais/demandes", demande);
    return data;
  },

  /** #27: assistant, request in `VALIDEE`, once the bank has confirmed payment. */
  enregistrerPaiement: async (id: number): Promise<DemandeFrais> => {
    const { data } = await apiClient.patch<DemandeFrais>(`/frais/demandes/${id}/paiement`);
    return data;
  },
};
