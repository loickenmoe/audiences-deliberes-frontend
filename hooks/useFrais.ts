"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES } from "@/hooks/const";
import { fraisService, type DecisionFrais } from "@/services/fraisService";
import type { DemandeFrais } from "@/types/domaine";
import type { StatutCircuitFrais } from "@/types/enums";

/** Les trois étapes de décision du circuit ; le paiement, sans refus possible, a son propre hook. */
export type EtapeDecision = "conformite" | "opportunite" | "conjointe";

/** `null` : toutes les demandes. */
export function useDemandesFrais(statut: StatutCircuitFrais | null, page: number) {
  return useQuery({
    queryKey: [CLES.demandesFrais, statut ?? "toutes", page],
    queryFn: () => fraisService.lister(statut, page),
  });
}

export function useDemandeFrais(id: number) {
  return useQuery({
    queryKey: [CLES.demandeFrais, id],
    queryFn: () => fraisService.consulter(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}

const APPELS: Record<EtapeDecision, (id: number, decision: DecisionFrais) => Promise<DemandeFrais>> = {
  conformite: fraisService.controlerConformite,
  opportunite: fraisService.controlerOpportunite,
  conjointe: fraisService.validerConjointement,
};

/**
 * Chaque décision renvoie la demande à jour, décisions comprises : le détail est remplacé
 * directement, et toutes les vues de la file sont rechargées — la demande en change.
 */
function useApresDecision() {
  const client = useQueryClient();
  return (demande: DemandeFrais) => {
    client.setQueryData([CLES.demandeFrais, demande.id], demande);
    void client.invalidateQueries({ queryKey: [CLES.demandesFrais] });
  };
}

export function useDecisionFrais() {
  const apres = useApresDecision();
  return useMutation({
    mutationFn: ({ etape, id, decision }: { etape: EtapeDecision; id: number; decision: DecisionFrais }) =>
      APPELS[etape](id, decision),
    onSuccess: apres,
  });
}

export function usePaiementFrais() {
  const apres = useApresDecision();
  return useMutation({
    mutationFn: (id: number) => fraisService.enregistrerPaiement(id),
    onSuccess: apres,
  });
}
