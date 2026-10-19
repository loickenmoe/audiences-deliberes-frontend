import { apiClient } from "@/lib/api/client";
import type { ConfigurationSysteme } from "@/types/domaine";

/**
 * System settings (#47, #48). Not paginated: about fifteen keys, defined by backend migrations.
 * Each entry carries its input rule, which drives the form; the frontend does not redeclare
 * bounds or accepted values.
 */
export const configurationService = {
  /** #47: readable with `ROLE_CONSULTATION`. */
  lister: async (): Promise<ConfigurationSysteme[]> => {
    const { data } = await apiClient.get<ConfigurationSysteme[]>("/configurations");
    return data;
  },

  /**
   * #48: DJ only. The backend validates the value per key (400 if invalid) and returns the
   * normalized value (trimmed, lists upper-cased).
   */
  modifier: async (cle: string, valeur: string): Promise<ConfigurationSysteme> => {
    const { data } = await apiClient.put<ConfigurationSysteme>(`/configurations/${cle}`, { valeur });
    return data;
  },
};
