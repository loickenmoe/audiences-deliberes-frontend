import { apiClient } from "@/lib/api/client";
import type { SupervisionNotifications } from "@/types/domaine";

/**
 * External notification monitoring, restricted to DJ and DJA: rows carry recipient contact details
 * and provider error messages, so the backend reserves them to these two profiles.
 */
export const notificationService = {
  superviser: async (dateDebut: string, dateFin: string): Promise<SupervisionNotifications> => {
    const { data } = await apiClient.get<SupervisionNotifications>("/notifications/supervision", {
      params: { dateDebut, dateFin },
    });
    return data;
  },

  /** Re-queues an abandoned delivery once the cause of its failure has been fixed. */
  relancer: async (id: number): Promise<void> => {
    await apiClient.post(`/notifications/${id}/relancer`);
  },
};
