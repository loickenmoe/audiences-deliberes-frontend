import { apiClient } from "@/lib/api/client";
import type {
  Delibere,
  EnregistrerDelibere,
  Prorogation,
  ProrogerDelibere,
  RabattreDelibere,
  Recours,
  ViderDelibere,
} from "@/types/domaine";
import type { StatutExpedition } from "@/types/enums";

/**
 * Deliberations (#18 to #22, #58): 1:1 mirror of the endpoints. Lifecycle: placed under
 * deliberation without a result, then extensions or reopening while pending, then the result,
 * which closes the deliberation. The backend owns the rules; the screen replays them to offer
 * only admissible actions.
 */
export const delibereService = {
  /** #58: deliberations of a case, most recent first, with their state. */
  lister: async (dossierId: number): Promise<Delibere[]> => {
    const { data } = await apiClient.get<Delibere[]>(`/dossiers/${dossierId}/deliberes`);
    return data;
  },

  /**
   * #18: without a result, the case is placed under deliberation (step stays "under
   * deliberation"). With a result, the deliberation is recorded and closed in one action.
   */
  enregistrer: async (dossierId: number, corps: EnregistrerDelibere): Promise<Delibere> => {
    const { data } = await apiClient.post<Delibere>(`/dossiers/${dossierId}/deliberes`, corps);
    return data;
  },

  /** The decision is delivered: the step moves to "deliberation closed". */
  vider: async (delibereId: number, corps: ViderDelibere): Promise<Delibere> => {
    const { data } = await apiClient.put<Delibere>(`/deliberes/${delibereId}/resultat`, corps);
    return data;
  },

  /**
   * #19: deliberation extended to a new date. Beyond the threshold, the response is a 201 with
   * `alerte: true`: the extension is recorded and the DJ and DJA are alerted. Not an error.
   */
  proroger: async (delibereId: number, corps: ProrogerDelibere): Promise<Prorogation> => {
    const { data } = await apiClient.post<Prorogation>(`/deliberes/${delibereId}/prorogations`, corps);
    return data;
  },

  /** Extension history, in the order they were ordered. */
  listerProrogations: async (delibereId: number): Promise<Prorogation[]> => {
    const { data } = await apiClient.get<Prorogation[]>(`/deliberes/${delibereId}/prorogations`);
    return data;
  },

  /** #20: the judge reopens proceedings; the step returns to "in progress". Reason required. */
  rabattre: async (delibereId: number, corps: RabattreDelibere): Promise<void> => {
    await apiClient.post(`/deliberes/${delibereId}/rabattement`, corps);
  },

  /** #21: read-only tracking of the appeal deadline (legal officer only). */
  recours: async (delibereId: number): Promise<Recours> => {
    const { data } = await apiClient.get<Recours>(`/deliberes/${delibereId}/recours`);
    return data;
  },

  /** #22: obtaining the enforceable copy, only possible once the deliberation is closed. */
  modifierExpedition: async (delibereId: number, statutExpedition: StatutExpedition): Promise<Delibere> => {
    const { data } = await apiClient.put<Delibere>(`/deliberes/${delibereId}/expedition`, { statutExpedition });
    return data;
  },
};
