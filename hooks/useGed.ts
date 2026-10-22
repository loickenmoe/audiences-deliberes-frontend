"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES, TAILLE_PAGE } from "@/hooks/const";
import { gedService } from "@/services/gedService";
import type { StatutSuppression } from "@/types/domaine";

/** `null`: full history. */
export function useDemandesSuppression(statut: StatutSuppression | null, page = 0, size = TAILLE_PAGE) {
  return useQuery({
    queryKey: [CLES.demandesSuppression, statut ?? "toutes", page, size],
    queryFn: () => gedService.listerDemandesSuppression(statut, page, size),
  });
}

/** A decision changes the queue (both views) and, if approved, the documents of the case. */
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

/** Queue of proposed shares, validated by the DJ and DJA. */
export function usePartagesAvocat(page = 0, size = TAILLE_PAGE) {
  return useQuery({
    queryKey: [CLES.partagesAvocat, page, size],
    queryFn: () => gedService.partagesAvocat(page, size),
  });
}

/**
 * A sharing action changes both the case's Documents tab and the DJ queue (a proposal enters it,
 * a validation or withdrawal removes it), so both are reloaded together.
 */
function useInvalidationPartage() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: [CLES.documentsDossier] });
    void client.invalidateQueries({ queryKey: [CLES.partagesAvocat] });
  };
}

/**
 * Whether an assigned lawyer is retained on the case. Re-read on each tab mount so that a
 * constitution signed elsewhere clears the warning.
 */
export function useEtatPartageDossier(dossierId: number) {
  return useQuery({
    queryKey: [CLES.etatPartageDossier, dossierId],
    queryFn: () => gedService.etatPartageDossier(dossierId),
  });
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
    // Keep the current report displayed while another date loads.
    placeholderData: (precedent) => precedent,
  });
}
