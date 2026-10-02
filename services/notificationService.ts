import { apiClient } from "@/lib/api/client";
import type { SupervisionNotifications } from "@/types/domaine";

/**
 * Supervision des notifications externes (backend D17, Q-120) — DJ et DJA.
 *
 * Ces lignes portent des coordonnées de destinataires et les erreurs renvoyées par les fournisseurs :
 * le backend les réserve à ces deux profils, et l'écran s'aligne.
 */
export const notificationService = {
  superviser: async (dateDebut: string, dateFin: string): Promise<SupervisionNotifications> => {
    const { data } = await apiClient.get<SupervisionNotifications>("/notifications/supervision", {
      params: { dateDebut, dateFin },
    });
    return data;
  },

  /** Remet en file un envoi abandonné, une fois corrigée la cause de son échec. */
  relancer: async (id: number): Promise<void> => {
    await apiClient.post(`/notifications/${id}/relancer`);
  },
};
