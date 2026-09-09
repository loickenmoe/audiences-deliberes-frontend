"use client";

import { useQuery } from "@tanstack/react-query";

import { CLES, FRAICHEUR_REFERENTIEL } from "@/hooks/const";
import { referentielService } from "@/services/referentielService";
import type { CategorieDossier } from "@/types/enums";

/** Natures de dossier, filtrables par catégorie — le formulaire s'adapte à la catégorie choisie. */
export function useNaturesDossier(categorie?: CategorieDossier) {
  return useQuery({
    queryKey: [CLES.naturesDossier, categorie ?? "toutes"],
    queryFn: () => referentielService.naturesDossier(categorie),
    staleTime: FRAICHEUR_REFERENTIEL,
  });
}

export function useTypesClientSensible() {
  return useQuery({
    queryKey: [CLES.typesClientSensible],
    queryFn: () => referentielService.typesClientSensible(),
    staleTime: FRAICHEUR_REFERENTIEL,
  });
}

/** Annuaire interne. `profil` filtre par code de profil (`JURISTE`, `DJ`, …). */
export function useUtilisateurs(profil?: string) {
  return useQuery({
    queryKey: [CLES.utilisateurs, profil ?? "tous"],
    queryFn: () => referentielService.utilisateurs(profil ? { profil } : undefined),
    staleTime: FRAICHEUR_REFERENTIEL,
  });
}
