import { TAILLE_PAGE } from "@/hooks/const";
import { apiClient, type PageReponse } from "@/lib/api/client";
import type { CreerIntervenant, Intervenant, ModifierIntervenant } from "@/types/domaine";
import type { TypeIntervenant } from "@/types/enums";

/**
 * Stakeholder directory (#61, #62). Required at startup: without a lawyer, no case can be created
 * (`avocatsAffectes` is mandatory). No deletion is exposed.
 */
const BASE = "/intervenants";

export const intervenantService = {
  /**
   * #62: `ROLE_CONSULTATION`. Paginated; returns both types when unfiltered. `nom` drives the
   * pickers' search-as-you-type.
   */
  lister: async (params: {
    type?: TypeIntervenant;
    nom?: string;
    page?: number;
    size?: number;
  } = {}): Promise<PageReponse<Intervenant>> => {
    const { data } = await apiClient.get<PageReponse<Intervenant>>(BASE, {
      params: {
        ...(params.type ? { type: params.type } : {}),
        ...(params.nom ? { nom: params.nom } : {}),
        page: params.page ?? 0,
        size: params.size ?? TAILLE_PAGE,
      },
    });
    return data;
  },

  /** #61: `ROLE_DJ`, `ROLE_DJA`. See invariants on {@link CreerIntervenant}. */
  creer: async (corps: CreerIntervenant): Promise<Intervenant> => {
    const { data } = await apiClient.post<Intervenant>(BASE, corps);
    return data;
  },

  /**
   * `ROLE_DJ`, `ROLE_DJA`. Type and login id are fixed: only name, contact details and
   * notification settings can be changed.
   */
  modifier: async (id: number, corps: ModifierIntervenant): Promise<Intervenant> => {
    const { data } = await apiClient.put<Intervenant>(`${BASE}/${id}`, corps);
    return data;
  },
};
