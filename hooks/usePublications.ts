"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES } from "@/hooks/const";
import { publicationService, type DecisionPublication } from "@/services/publicationService";
import type { StatutPublication } from "@/types/enums";

export function usePublications(filtres: { dossierId?: number; statut?: StatutPublication | null; page?: number }) {
  return useQuery({
    queryKey: [CLES.publications, filtres],
    queryFn: () => publicationService.lister(filtres),
  });
}

export function usePublication(id: number) {
  return useQuery({
    queryKey: [CLES.publication, id],
    queryFn: () => publicationService.consulter(id),
    enabled: Number.isFinite(id) && id > 0,
    // 403 (accès restreint) et 404 (non validée) sont des réponses, pas des pannes : ne pas insister.
    retry: false,
  });
}

/** Toute décision ou tout échange change le détail et la file : les deux sont rechargés. */
function useRecharger() {
  const client = useQueryClient();
  return (id: number) => {
    void client.invalidateQueries({ queryKey: [CLES.publication, id] });
    void client.invalidateQueries({ queryKey: [CLES.publications] });
  };
}

export function useValiderPublication() {
  const recharger = useRecharger();
  return useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: DecisionPublication }) => publicationService.valider(id, decision),
    onSuccess: (_, { id }) => recharger(id),
  });
}

export function useCommenterPublication() {
  const recharger = useRecharger();
  return useMutation({
    mutationFn: ({ id, contenu }: { id: number; contenu: string }) => publicationService.commenter(id, contenu),
    onSuccess: (_, { id }) => recharger(id),
  });
}

export function useTransmettreCorrespondance() {
  const recharger = useRecharger();
  return useMutation({
    mutationFn: ({ id, contenu }: { id: number; contenu: string }) => publicationService.transmettreCorrespondance(id, contenu),
    onSuccess: (_, { id }) => recharger(id),
  });
}
