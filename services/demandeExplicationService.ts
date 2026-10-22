import { TAILLE_PAGE } from "@/hooks/const";
import { apiClient, type PageReponse } from "@/lib/api/client";
import type { DemandeExplication } from "@/types/domaine";

/**
 * Explanation requests. A single read route serves two audiences: management sees all requests,
 * a lawyer only theirs. The server scopes by caller identity; there is deliberately no scope
 * parameter, which would let a lawyer request the full list.
 */
export const demandeExplicationService = {
  /** `enAttente` only applies to management: a lawyer sees all of theirs, answered or not. */
  lister: async (
    enAttente = false,
    page = 0,
    size = TAILLE_PAGE,
  ): Promise<PageReponse<DemandeExplication>> => {
    const { data } = await apiClient.get<PageReponse<DemandeExplication>>("/demandes-explication", {
      params: { enAttente, page, size },
    });
    return data;
  },

  /** DJ and DJA. 409 if a request is already awaiting an answer from this lawyer. */
  demander: async (demande: {
    avocatId: number;
    dossierId?: number | null;
    contenu: string;
  }): Promise<DemandeExplication> => {
    const { data } = await apiClient.post<DemandeExplication>("/demandes-explication", demande);
    return data;
  },

  /**
   * The lawyer answers, once only. `PUT` because it completes an existing request. The server
   * rejects an answer to a request not addressed to the caller (403) and a second answer (409).
   */
  repondre: async (id: number, reponse: string): Promise<DemandeExplication> => {
    const { data } = await apiClient.put<DemandeExplication>(`/demandes-explication/${id}/reponse`, {
      reponse,
    });
    return data;
  },
};
