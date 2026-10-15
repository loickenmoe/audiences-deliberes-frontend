"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES, TAILLE_PAGE } from "@/hooks/const";
import { gedService } from "@/services/gedService";
import type { StatutSuppression } from "@/types/domaine";

/** `null` : tout l'historique. */
export function useDemandesSuppression(statut: StatutSuppression | null, page = 0, size = TAILLE_PAGE) {
  return useQuery({
    queryKey: [CLES.demandesSuppression, statut ?? "toutes", page, size],
    queryFn: () => gedService.listerDemandesSuppression(statut, page, size),
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

/** QF-64 — la file des partages proposés, que le DJ et la DJA valident. */
export function usePartagesAvocat(page = 0, size = TAILLE_PAGE) {
  return useQuery({
    queryKey: [CLES.partagesAvocat, page, size],
    queryFn: () => gedService.partagesAvocat(page, size),
  });
}

/**
 * Un geste de partage change l'onglet Documents du dossier **et** la file du DJ : une proposition y
 * entre, une validation ou un retrait l'en fait sortir. Les deux sont rechargés ensemble.
 */
function useInvalidationPartage() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: [CLES.documentsDossier] });
    void client.invalidateQueries({ queryKey: [CLES.partagesAvocat] });
  };
}

export function usePartagerDocument() {
  const invalider = useInvalidationPartage();
  return useMutation({ mutationFn: gedService.partagerAvecAvocat, onSuccess: invalider });
}

export function useRetirerPartage() {
  const invalider = useInvalidationPartage();
  return useMutation({ mutationFn: gedService.retirerPartageAvocat, onSuccess: invalider });
}

export function useArbitrerPartage() {
  const invalider = useInvalidationPartage();
  return useMutation({
    mutationFn: ({ documentId, motif }: { documentId: number; motif?: string }) =>
      gedService.arbitrerPartageAvocat(
        documentId,
        motif === undefined ? { decision: "VALIDE" } : { decision: "REJETE", motif },
      ),
    onSuccess: invalider,
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
