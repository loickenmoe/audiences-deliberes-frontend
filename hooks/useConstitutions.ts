"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES, TAILLE_PAGE } from "@/hooks/const";
import {
  constitutionService,
  type DecisionConstitution,
  type RedactionLettre,
} from "@/services/constitutionService";
import type { StatutConstitution } from "@/types/enums";

/** `null`: full history. */
export function useConstitutions(statut: StatutConstitution | null, page = 0, size = TAILLE_PAGE) {
  return useQuery({
    queryKey: [CLES.constitutions, statut ?? "toutes", page, size],
    queryFn: () => constitutionService.lister(statut, page, size),
  });
}

/**
 * The letter of a request. Only fetched once the drafting screen opens, to avoid one call per
 * queue row.
 */
export function useLettreConstitution(demandeId: number | null) {
  return useQuery({
    queryKey: [CLES.constitutions, "lettre", demandeId],
    queryFn: () => constitutionService.lettre(demandeId as number),
    enabled: demandeId !== null,
  });
}

/**
 * Saves the legal officer's draft. The constitution queue is invalidated because it shows the
 * last modification date.
 */
export function useRedigerLettre() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ demandeId, lettre }: { demandeId: number; lettre: RedactionLettre }) =>
      constitutionService.redigerLettre(demandeId, lettre),
    onSuccess: () => void client.invalidateQueries({ queryKey: [CLES.constitutions] }),
  });
}

export function useSolliciterConstitution() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: constitutionService.solliciter,
    onSuccess: () => void client.invalidateQueries({ queryKey: [CLES.constitutions] }),
  });
}

/** Signing files the letter into the case's document store, so its documents are reloaded too. */
export function useDeciderConstitution() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: DecisionConstitution }) => constitutionService.decider(id, decision),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [CLES.constitutions] });
      void client.invalidateQueries({ queryKey: [CLES.documentsDossier] });
    },
  });
}

export function useRepertoire(nom: string, page = 0, size = TAILLE_PAGE) {
  return useQuery({
    queryKey: [CLES.repertoire, nom, page, size],
    queryFn: () => constitutionService.repertoire(nom || undefined, page, size),
    // Keep the current list displayed while the next search runs.
    placeholderData: (precedent) => precedent,
  });
}
