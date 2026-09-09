"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES } from "@/hooks/const";
import { dossierService } from "@/services/dossierService";
import type { CreerDossier, FiltresDossiers } from "@/types/domaine";

/**
 * Liste paginée des dossiers.
 *
 * Les filtres entrent dans la clé de cache : deux recherches différentes ne doivent pas se
 * recouvrir, sinon la seconde afficherait brièvement les résultats de la première.
 */
export function useDossiers(filtres: FiltresDossiers = {}) {
  return useQuery({
    queryKey: [CLES.dossiers, filtres],
    queryFn: () => dossierService.lister(filtres),
  });
}

export function useDossier(id: number) {
  return useQuery({
    queryKey: [CLES.dossier, id],
    queryFn: () => dossierService.consulter(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}

export function useCreerDossier() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dossier: CreerDossier) => dossierService.creer(dossier),
    onSuccess: (cree) => {
      // Toutes les listes sont invalidées, quels que soient leurs filtres : le nouveau dossier peut
      // apparaître dans plusieurs d'entre elles.
      void client.invalidateQueries({ queryKey: [CLES.dossiers] });
      // La vue consolidée du client gagne une ligne.
      void client.invalidateQueries({ queryKey: [CLES.clientDossiers, cree.clientId] });
    },
  });
}
