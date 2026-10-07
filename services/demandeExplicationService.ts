import { TAILLE_PAGE } from "@/hooks/const";
import { apiClient, type PageReponse } from "@/lib/api/client";
import type { DemandeExplication } from "@/types/domaine";

/**
 * Les demandes d'explication (N7 temps 2, observation 8).
 *
 * **Une seule route de lecture pour deux publics.** La direction y voit toutes les demandes,
 * l'avocat les siennes - et c'est le **serveur** qui décide lesquelles, sur l'identité de qui
 * appelle. Un paramètre de périmètre envoyé par l'écran suffirait à un avocat pour demander la
 * liste entière ; il n'y en a donc pas.
 */
export const demandeExplicationService = {
  /** `enAttente` ne vaut que pour la direction : un avocat voit les siennes, répondues ou non. */
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

  /** DJ et DJA. 409 si une demande attend déjà sa réponse pour cet avocat. */
  demander: async (demande: {
    avocatId: number;
    dossierId?: number | null;
    contenu: string;
  }): Promise<DemandeExplication> => {
    const { data } = await apiClient.post<DemandeExplication>("/demandes-explication", demande);
    return data;
  },

  /**
   * L'avocat répond, une seule fois.
   *
   * `PUT` et non `POST` : on complète une demande existante. Le serveur refuse une réponse qui ne
   * vous est pas adressée (403) et une seconde réponse (409) - une prise de position datée que la
   * direction lira peut-être des mois plus tard ne se récrit pas.
   */
  repondre: async (id: number, reponse: string): Promise<DemandeExplication> => {
    const { data } = await apiClient.put<DemandeExplication>(`/demandes-explication/${id}/reponse`, {
      reponse,
    });
    return data;
  },
};
