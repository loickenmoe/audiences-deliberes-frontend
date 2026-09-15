import { TAILLE_PAGE } from "@/hooks/const";
import { apiClient, type PageReponse } from "@/lib/api/client";
import type { Alerte, ConfigurationSysteme } from "@/types/domaine";
import type { StatutAlerte, TypeAlerte } from "@/types/enums";

/**
 * Alertes et notifications (#44, #45, #46).
 *
 * `GET /alertes/mes-notifications` est le **repli garanti** du canal temps réel : le backend
 * enregistre l'alerte avant de tenter la diffusion WebSocket, ce que cette liste rapporte donc
 * toujours, canal ouvert ou non.
 */
export const alerteService = {
  /**
   * #45 — les notifications du compte connecté, de la plus récente à la plus ancienne côté
   * backend. `statut` omis : les deux statuts confondus.
   *
   * `type` et `dossierId` sont arrivés en Q-102 : avec dix-sept types d'alerte et des rappels à J-7,
   * J-3 et J-1, la liste se remplit vite. Ils sont filtrés **par le serveur** — les rejouer ici
   * n'aurait cherché que dans la page affichée, et le décompte aurait menti.
   */
  mesNotifications: async (
    statut: StatutAlerte | null,
    page = 0,
    size = TAILLE_PAGE,
    type?: TypeAlerte,
    dossierId?: number,
  ): Promise<PageReponse<Alerte>> => {
    const { data } = await apiClient.get<PageReponse<Alerte>>("/alertes/mes-notifications", {
      params: {
        ...(statut ? { statut } : {}),
        ...(type ? { type } : {}),
        ...(dossierId ? { dossierId } : {}),
        page,
        size,
      },
    });
    return data;
  },

  /** #46 — **seul le destinataire** peut marquer sa notification traitée ; 403 sinon. */
  traiter: async (id: number): Promise<Alerte> => {
    const { data } = await apiClient.patch<Alerte>(`/alertes/${id}/traiter`);
    return data;
  },

  /**
   * #44 — DJ. Un seul type est adossé à un seuil configurable (`CHARGE_MAX_AVOCAT`, RG-ALR-02) ;
   * le backend refuse les autres. La réponse est la configuration mise à jour, pas une alerte.
   */
  modifierSeuil: async (type: TypeAlerte, seuil: number): Promise<ConfigurationSysteme> => {
    const { data } = await apiClient.put<ConfigurationSysteme>("/alertes/seuils", { type, seuil });
    return data;
  },
};
