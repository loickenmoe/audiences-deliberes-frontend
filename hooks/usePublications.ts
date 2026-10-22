"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES } from "@/hooks/const";
import { publicationService, type DecisionPublication } from "@/services/publicationService";
import type { StatutPublication } from "@/types/enums";

/**
 * @param actif set to `false` when the caller lacks the `consulterPublications` capability: the
 *              Hearings tab is open to all internal profiles but the publication list is not, so
 *              without this guard the SH would get a 403 on a screen it is allowed to see.
 */
export function usePublications(
  filtres: {
    dossierId?: number;
    statut?: StatutPublication | null;
    page?: number;
    size?: number;
  },
  actif = true,
) {
  return useQuery({
    queryKey: [CLES.publications, filtres],
    queryFn: () => publicationService.lister(filtres),
    enabled: actif,
  });
}

export function usePublication(id: number) {
  return useQuery({
    queryKey: [CLES.publication, id],
    queryFn: () => publicationService.consulter(id),
    enabled: Number.isFinite(id) && id > 0,
    // 403 (restricted access) and 404 (not validated) are answers, not failures: do not retry.
    retry: false,
  });
}

/** Any decision or exchange changes both the detail and the queue, so both are reloaded. */
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
