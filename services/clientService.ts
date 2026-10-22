import { TAILLE_PAGE } from "@/hooks/const";
import { apiClient, type PageReponse } from "@/lib/api/client";
import type { Client, CreerClient, ModifierClient, VueClientDossiers } from "@/types/domaine";

/**
 * 1:1 mirror of the backend client endpoints (#9 to #12). No business logic here: rules live in
 * hooks and screens.
 */
const BASE = "/clients";

export const clientService = {
  /** #9: `ROLE_CONSULTATION`. Partial match on name, exact match on reference. */
  rechercher: async (params: {
    nom?: string;
    reference?: string;
    page?: number;
    size?: number;
  }): Promise<PageReponse<Client>> => {
    // Always send the size so the page matches the screen's default, not the backend's.
    const { data } = await apiClient.get<PageReponse<Client>>(BASE, {
      params: { ...params, size: params.size ?? TAILLE_PAGE },
    });
    return data;
  },

  /** #10: 404 if the client does not exist. */
  consulter: async (id: number): Promise<Client> => {
    const { data } = await apiClient.get<Client>(`${BASE}/${id}`);
    return data;
  },

  /**
   * #11: consolidated view, grouped by category and independent of the legal officer's assignment.
   * Empty structure (200) if the client has no case; 404 if the client does not exist.
   */
  vueConsolidee: async (clientId: number): Promise<VueClientDossiers> => {
    const { data } = await apiClient.get<VueClientDossiers>(`${BASE}/${clientId}/dossiers`);
    return data;
  },

  /** #12: `ROLE_SAISIE`. */
  creer: async (corps: CreerClient): Promise<Client> => {
    const { data } = await apiClient.post<Client>(BASE, corps);
    return data;
  },

  /**
   * `ROLE_SAISIE`, like creation. The reference cannot be changed; a no-op update writes nothing
   * on the backend (neither data nor history).
   */
  modifier: async (id: number, corps: ModifierClient): Promise<Client> => {
    const { data } = await apiClient.put<Client>(`${BASE}/${id}`, corps);
    return data;
  },
};
