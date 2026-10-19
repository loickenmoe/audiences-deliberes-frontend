"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES, TAILLE_PAGE } from "@/hooks/const";
import { fraisService, type DecisionFrais } from "@/services/fraisService";
import type { DemandeFrais } from "@/types/domaine";
import type { StatutCircuitFrais } from "@/types/enums";

/** The three decision steps of the workflow; payment, which cannot be refused, has its own hook. */
export type EtapeDecision = "conformite" | "opportunite" | "conjointe";

/** `null`: all requests. */
export function useDemandesFrais(statut: StatutCircuitFrais | null, page: number, size = TAILLE_PAGE) {
  return useQuery({
    queryKey: [CLES.demandesFrais, statut ?? "toutes", page, size],
    queryFn: () => fraisService.lister(statut, page, size),
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
 * Each decision returns the updated request, decisions included: the detail is replaced directly
 * and every queue view is reloaded, since the request changes queue.
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
