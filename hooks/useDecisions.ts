"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES } from "@/hooks/const";
import { decisionService, type FiltresJurisprudence } from "@/services/decisionService";
import type { ArchiverJurisprudence, CreerAdjudication, CreerCondamnation } from "@/types/domaine";
import type { StatutPaiementCondamnation } from "@/types/enums";

export function useDecisionsDossier(dossierId: number) {
  return useQuery({
    queryKey: [CLES.decisionsDossier, dossierId],
    queryFn: () => decisionService.lister(dossierId),
    enabled: Number.isFinite(dossierId) && dossierId > 0,
  });
}

/** Une décision s'ajoute à la liste du dossier et à son historique. */
function useRechargerDossier(dossierId: number) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: [CLES.decisionsDossier, dossierId] });
    void client.invalidateQueries({ queryKey: [CLES.dossier, dossierId] });
  };
}

export function useCreerAdjudication(dossierId: number) {
  const recharger = useRechargerDossier(dossierId);
  return useMutation({
    mutationFn: (corps: CreerAdjudication) => decisionService.creerAdjudication(dossierId, corps),
    onSuccess: recharger,
  });
}

export function useCreerCondamnation(dossierId: number) {
  const recharger = useRechargerDossier(dossierId);
  return useMutation({
    mutationFn: (corps: CreerCondamnation) => decisionService.creerCondamnation(dossierId, corps),
    onSuccess: recharger,
  });
}

export function useModifierStatutCondamnation(dossierId: number) {
  const recharger = useRechargerDossier(dossierId);
  return useMutation({
    mutationFn: ({ id, statutPaiement }: { id: number; statutPaiement: StatutPaiementCondamnation }) =>
      decisionService.modifierStatutCondamnation(id, statutPaiement),
    onSuccess: recharger,
  });
}

export function useJurisprudences(filtres: FiltresJurisprudence) {
  return useQuery({
    queryKey: [CLES.jurisprudences, filtres],
    queryFn: () => decisionService.rechercherJurisprudences(filtres),
    // Garder la liste affichée pendant la recherche suivante.
    placeholderData: (precedent) => precedent,
  });
}

export function useArchiverJurisprudence() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ indexation, fichier }: { indexation: ArchiverJurisprudence; fichier: File }) =>
      decisionService.archiverJurisprudence(indexation, fichier),
    onSuccess: () => void client.invalidateQueries({ queryKey: [CLES.jurisprudences] }),
  });
}
