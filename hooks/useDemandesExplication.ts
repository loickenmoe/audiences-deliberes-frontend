"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES } from "@/hooks/const";
import { demandeExplicationService } from "@/services/demandeExplicationService";

/**
 * Explanation requests. The same query serves management and lawyers: the server scopes results
 * by the caller's identity, so the screen filters nothing.
 */
export function useDemandesExplication(enAttente: boolean, page: number) {
  return useQuery({
    queryKey: [CLES.demandesExplication, { enAttente, page }],
    queryFn: () => demandeExplicationService.lister(enAttente, page),
  });
}

/**
 * Ask and answer mutations. Both invalidate the same key: a new request or answer changes the
 * queue on both sides.
 */
export function useEcritureExplication() {
  const client = useQueryClient();
  const invalider = () => client.invalidateQueries({ queryKey: [CLES.demandesExplication] });

  const demander = useMutation({
    mutationFn: demandeExplicationService.demander,
    onSuccess: invalider,
  });
  const repondre = useMutation({
    mutationFn: ({ id, reponse }: { id: number; reponse: string }) =>
      demandeExplicationService.repondre(id, reponse),
    onSuccess: invalider,
  });

  return { demander, repondre };
}
