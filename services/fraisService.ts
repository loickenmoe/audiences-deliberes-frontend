import { apiClient, type PageReponse } from "@/lib/api/client";
import type { DemandeFrais } from "@/types/domaine";
import type { StatutCircuitFrais } from "@/types/enums";

/** Un accord, ou un refus — toujours motivé (RG-INT-03). */
export type DecisionFrais = { accord: true } | { accord: false; motifRejet: string };

function corps(decision: DecisionFrais) {
  return decision.accord ? {} : { motifRejet: decision.motifRejet };
}

/**
 * Frais d'avocats, circuit interne (#24 à #28 et le détail ajouté en M16, Q-82 backend). Le dépôt
 * par l'avocat (#23) arrive avec son portail, en F16.
 *
 * Le backend arbitre tout : statut attendu à chaque étape (409 sinon), motif obligatoire à chaque
 * rejet (400), double vote refusé (409), paiement réservé à une demande validée (400).
 */
export const fraisService = {
  /**
   * #28 — file de travail, la plus récente d'abord. Transverse pour le personnel interne ; l'avocat
   * n'y voit que ses propres demandes.
   */
  lister: async (statut: StatutCircuitFrais | null, page = 0, size = 20): Promise<PageReponse<DemandeFrais>> => {
    const { data } = await apiClient.get<PageReponse<DemandeFrais>>("/frais/demandes", {
      params: { statut: statut ?? undefined, page, size },
    });
    return data;
  },

  /** Détail et décisions du circuit (M16, Q-82) — l'avocat ne lit que les siennes (403 sinon). */
  consulter: async (id: number): Promise<DemandeFrais> => {
    const { data } = await apiClient.get<DemandeFrais>(`/frais/demandes/${id}`);
    return data;
  },

  /** #24 — Assistante, demande `DEPOSEE`. Conforme : elle passe au DJA. */
  controlerConformite: async (id: number, decision: DecisionFrais): Promise<DemandeFrais> => {
    const { data } = await apiClient.put<DemandeFrais>(`/frais/demandes/${id}/conformite`, {
      conforme: decision.accord,
      ...corps(decision),
    });
    return data;
  },

  /**
   * #25 — DJA, demande `CONFORMITE`. Un accord valide la demande, sauf dossier sensible ou montant
   * au-delà du seuil : elle passe alors en validation conjointe (`OPPORTUNITE`).
   */
  controlerOpportunite: async (id: number, decision: DecisionFrais): Promise<DemandeFrais> => {
    const { data } = await apiClient.put<DemandeFrais>(`/frais/demandes/${id}/opportunite`, {
      accord: decision.accord,
      ...corps(decision),
    });
    return data;
  },

  /** #26 — DJ et DJA, chacun son accord ; les deux valident, un seul refus rejette. */
  validerConjointement: async (id: number, decision: DecisionFrais): Promise<DemandeFrais> => {
    const { data } = await apiClient.post<DemandeFrais>(`/frais/demandes/${id}/validation-conjointe`, {
      accord: decision.accord,
      ...corps(decision),
    });
    return data;
  },

  /** #27 — Assistante, demande `VALIDEE`, une fois le paiement confirmé par les circuits de la Banque. */
  enregistrerPaiement: async (id: number): Promise<DemandeFrais> => {
    const { data } = await apiClient.patch<DemandeFrais>(`/frais/demandes/${id}/paiement`);
    return data;
  },
};
