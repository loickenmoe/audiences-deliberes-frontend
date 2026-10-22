import { TAILLE_PAGE } from "@/hooks/const";
import { apiClient, type PageReponse } from "@/lib/api/client";
import type { Alerte, ConfigurationSysteme, StatistiquesDiffusion } from "@/types/domaine";
import type { StatutAlerte, TypeAlerte } from "@/types/enums";

/**
 * Alerts and notifications (#44, #45, #46). `GET /alertes/mes-notifications` is the guaranteed
 * fallback of the real-time channel: the backend stores each alert before the WebSocket push.
 */
export const alerteService = {
  /**
   * #45: notifications of the current account, most recent first; omitted `statut` means both.
   * `type` and `dossierId` are filtered server-side so that paging and totals stay correct.
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

  /** #46: only the recipient can mark the notification as handled; 403 otherwise. */
  traiter: async (id: number): Promise<Alerte> => {
    const { data } = await apiClient.patch<Alerte>(`/alertes/${id}/traiter`);
    return data;
  },

  /**
   * #44: DJ. Only one type has a configurable threshold (`CHARGE_MAX_AVOCAT`, RG-ALR-02); the
   * backend rejects the others. Returns the updated configuration, not an alert.
   */
  modifierSeuil: async (type: TypeAlerte, seuil: number): Promise<ConfigurationSysteme> => {
    const { data } = await apiClient.put<ConfigurationSysteme>("/alertes/seuils", { type, seuil });
    return data;
  },

  /**
   * #51: DJ and DJA. In-app channel delivery rate over a window. The window is mandatory so that
   * a recent outage is not hidden by a cumulative rate. ISO dates (`YYYY-MM-DD`), inclusive.
   */
  statistiquesDiffusion: async (
    dateDebut: string,
    dateFin: string,
  ): Promise<StatistiquesDiffusion> => {
    const { data } = await apiClient.get<StatistiquesDiffusion>("/alertes/statistiques-diffusion", {
      params: { dateDebut, dateFin },
    });
    return data;
  },
};
