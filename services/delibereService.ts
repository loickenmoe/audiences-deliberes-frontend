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
 * Délibérés (#18 à #22, #58, et les deux ajouts de Q-78) — miroir 1:1 des endpoints.
 *
 * Cycle (Q-78, conforme aux sources) : mise en délibéré sans résultat → prorogations ou rabattement
 * pendant l'attente → résultat, qui vide le délibéré. Les règles sont celles du backend ; l'écran
 * les rejoue pour ne proposer que les actions recevables.
 */
export const delibereService = {
  /** #58 — délibérés d'un dossier, le plus récent d'abord, avec leur état. */
  lister: async (dossierId: number): Promise<Delibere[]> => {
    const { data } = await apiClient.get<Delibere[]>(`/dossiers/${dossierId}/deliberes`);
    return data;
  },

  /**
   * #18 — sans résultat, **mise en délibéré** : l'étape reste « En délibéré ». Avec un résultat,
   * délibéré déjà rendu, enregistré et vidé d'un même geste.
   */
  enregistrer: async (dossierId: number, corps: EnregistrerDelibere): Promise<Delibere> => {
    const { data } = await apiClient.post<Delibere>(`/dossiers/${dossierId}/deliberes`, corps);
    return data;
  },

  /** 🆕 Q-78 — la décision est rendue : l'étape passe « Délibéré vidé ». */
  vider: async (delibereId: number, corps: ViderDelibere): Promise<Delibere> => {
    const { data } = await apiClient.put<Delibere>(`/deliberes/${delibereId}/resultat`, corps);
    return data;
  },

  /**
   * #19 — « délibéré prorogé au [date] ». Au-delà du seuil, la réponse porte `alerte: true` avec un
   * **201** : la prorogation est enregistrée, le DJ et la DJA sont alertés. Pas une erreur.
   */
  proroger: async (delibereId: number, corps: ProrogerDelibere): Promise<Prorogation> => {
    const { data } = await apiClient.post<Prorogation>(`/deliberes/${delibereId}/prorogations`, corps);
    return data;
  },

  /** 🆕 Q-78 — historique des prorogations, dans l'ordre où elles ont été prononcées. */
  listerProrogations: async (delibereId: number): Promise<Prorogation[]> => {
    const { data } = await apiClient.get<Prorogation[]>(`/deliberes/${delibereId}/prorogations`);
    return data;
  },

  /** #20 — le juge rouvre les débats : l'étape revient « En cours ». Motif obligatoire. */
  rabattre: async (delibereId: number, corps: RabattreDelibere): Promise<void> => {
    await apiClient.post(`/deliberes/${delibereId}/rabattement`, corps);
  },

  /** #21 — suivi du délai de recours, en lecture seule (réservé au juriste). */
  recours: async (delibereId: number): Promise<Recours> => {
    const { data } = await apiClient.get<Recours>(`/deliberes/${delibereId}/recours`);
    return data;
  },

  /** #22 — levée de la grosse, possible seulement une fois le délibéré vidé. */
  modifierExpedition: async (delibereId: number, statutExpedition: StatutExpedition): Promise<Delibere> => {
    const { data } = await apiClient.put<Delibere>(`/deliberes/${delibereId}/expedition`, { statutExpedition });
    return data;
  },
};
