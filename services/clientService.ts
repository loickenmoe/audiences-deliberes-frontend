import { TAILLE_PAGE } from "@/hooks/const";
import { apiClient, type PageReponse } from "@/lib/api/client";
import type { Client, CreerClient, ModifierClient, VueClientDossiers } from "@/types/domaine";

/**
 * Miroir 1:1 des endpoints clients du backend (#9 à #12).
 *
 * Aucune logique métier ici : un service traduit une signature TypeScript en appel HTTP, rien de
 * plus. Les règles vivent dans les hooks et les écrans.
 */
const BASE = "/clients";

export const clientService = {
  /** #9 — `ROLE_CONSULTATION`. Recherche partielle par nom, exacte par référence. */
  rechercher: async (params: {
    nom?: string;
    reference?: string;
    page?: number;
    size?: number;
  }): Promise<PageReponse<Client>> => {
    // La taille n'était pas transmise : la page valait donc le défaut du backend, pas celui de l'écran.
    const { data } = await apiClient.get<PageReponse<Client>>(BASE, {
      params: { ...params, size: params.size ?? TAILLE_PAGE },
    });
    return data;
  },

  /** #10 — 404 si le client n'existe pas. */
  consulter: async (id: number): Promise<Client> => {
    const { data } = await apiClient.get<Client>(`${BASE}/${id}`);
    return data;
  },

  /**
   * #11 — vue consolidée. Regroupe par catégorie et reste **indépendante de l'affectation du
   * juriste**. Structure vide (200) si le client n'a aucun dossier ; 404 s'il n'existe pas.
   */
  vueConsolidee: async (clientId: number): Promise<VueClientDossiers> => {
    const { data } = await apiClient.get<VueClientDossiers>(`${BASE}/${clientId}/dossiers`);
    return data;
  },

  /** #12 — `ROLE_SAISIE`. */
  creer: async (corps: CreerClient): Promise<Client> => {
    const { data } = await apiClient.post<Client>(BASE, corps);
    return data;
  },

  /**
   * 🆕 `PUT /clients/{id}` — `ROLE_SAISIE`, comme la création. La référence ne se modifie pas ;
   * une modification qui ne change rien n'écrit rien côté backend (ni base, ni historique).
   */
  modifier: async (id: number, corps: ModifierClient): Promise<Client> => {
    const { data } = await apiClient.put<Client>(`${BASE}/${id}`, corps);
    return data;
  },
};
