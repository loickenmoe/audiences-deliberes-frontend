"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES, TAILLE_PAGE } from "@/hooks/const";
import {
  constitutionService,
  type DecisionConstitution,
  type RedactionLettre,
} from "@/services/constitutionService";
import type { StatutConstitution } from "@/types/enums";

/** `null` : tout l'historique. */
export function useConstitutions(statut: StatutConstitution | null, page = 0, size = TAILLE_PAGE) {
  return useQuery({
    queryKey: [CLES.constitutions, statut ?? "toutes", page, size],
    queryFn: () => constitutionService.lister(statut, page, size),
  });
}

/**
 * La lettre d'une demande (backend Q-115 B2).
 *
 * `enabled` laisse l'appelant n'ouvrir la requête qu'au moment où l'écran de rédaction s'affiche :
 * charger la lettre de chaque ligne d'une file de trente demandes serait trente appels pour rien.
 */
export function useLettreConstitution(demandeId: number | null) {
  return useQuery({
    queryKey: [CLES.constitutions, "lettre", demandeId],
    queryFn: () => constitutionService.lettre(demandeId as number),
    enabled: demandeId !== null,
  });
}

/**
 * Enregistre la rédaction du juriste.
 *
 * La file des constitutions est invalidée au passage : la date de modification y figure, et une
 * lettre rédigée à l'instant ne doit pas s'y afficher comme si elle ne l'avait jamais été.
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
