import { apiClient } from "@/lib/api/client";
import type { ConfigurationSysteme } from "@/types/domaine";

/**
 * Paramètres système (#47, #48).
 *
 * La liste n'est pas paginée : sept clés, fixées par la migration `V2__donnees_reference.sql`.
 * Chaque entrée porte sa **règle de saisie** (backend Q-91), sur laquelle le formulaire se règle —
 * le frontend ne redéclare ni bornes ni valeurs acceptées.
 */
export const configurationService = {
  /** #47 — lecture ouverte à `ROLE_CONSULTATION`. */
  lister: async (): Promise<ConfigurationSysteme[]> => {
    const { data } = await apiClient.get<ConfigurationSysteme[]>("/configurations");
    return data;
  },

  /**
   * #48 — DJ seul. Le backend valide la valeur selon la clé et répond 400 en cas de saisie
   * incohérente ; il renvoie la valeur **normalisée** (espaces retirés, liste en majuscules).
   */
  modifier: async (cle: string, valeur: string): Promise<ConfigurationSysteme> => {
    const { data } = await apiClient.put<ConfigurationSysteme>(`/configurations/${cle}`, { valeur });
    return data;
  },
};
