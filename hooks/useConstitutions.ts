"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES, TAILLE_PAGE } from "@/hooks/const";
import { constitutionService, type DecisionConstitution } from "@/services/constitutionService";
import type { StatutConstitution } from "@/types/enums";

/** `null` : tout l'historique. */
export function useConstitutions(statut: StatutConstitution | null, page = 0, size = TAILLE_PAGE) {
  return useQuery({
    queryKey: [CLES.constitutions, statut ?? "toutes", page, size],
    queryFn: () => constitutionService.lister(statut, page, size),
  });
}

export function useSolliciterConstitution() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: constitutionService.solliciter,
    onSuccess: () => void client.invalidateQueries({ queryKey: [CLES.constitutions] }),
  });
}

/** Une signature dépose la lettre dans la GED du dossier : ses documents sont rechargés aussi. */
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
    // Garder la liste affichée pendant la recherche suivante.
    placeholderData: (precedent) => precedent,
  });
}
