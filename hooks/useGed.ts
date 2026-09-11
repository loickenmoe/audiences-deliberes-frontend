"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES } from "@/hooks/const";
import { gedService } from "@/services/gedService";
import type { StatutSuppression } from "@/types/domaine";

/** `null` : tout l'historique. */
export function useDemandesSuppression(statut: StatutSuppression | null) {
  return useQuery({
    queryKey: [CLES.demandesSuppression, statut ?? "toutes"],
    queryFn: () => gedService.listerDemandesSuppression(statut),
  });
}

/**
 * Une décision change la file (dans ses deux vues) et, si elle est approuvée, les documents du
 * dossier concerné.
 */
export function useDeciderSuppression() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, motifRejet }: { documentId: number; motifRejet?: string }) =>
      gedService.deciderSuppression(
        documentId,
        motifRejet === undefined ? { decision: "APPROUVEE" } : { decision: "REJETEE", motifRejet },
      ),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [CLES.demandesSuppression] });
      void client.invalidateQueries({ queryKey: [CLES.documentsDossier] });
    },
  });
}

export function useRapportJournalier(date: string) {
  return useQuery({
    queryKey: [CLES.rapportJournalier, date],
    queryFn: () => gedService.rapportJournalier(date),
    enabled: /^\d{4}-\d{2}-\d{2}$/.test(date),
    // Garder le rapport affiché pendant le chargement d'une autre date.
    placeholderData: (precedent) => precedent,
  });
}
