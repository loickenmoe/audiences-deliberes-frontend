"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES, FRAICHEUR_REFERENTIEL } from "@/hooks/const";
import { referentielService } from "@/services/referentielService";
import type { AgenceEcriture } from "@/types/domaine";
import type { CategorieDossier } from "@/types/enums";

/**
 * Bank branches, searched server-side. `recherche` is part of the cache key, with the long
 * reference-data freshness. `actifSeulement = false` is only meaningful for the admin screen:
 * elsewhere a closed branch would yield a code the backend rejects.
 */
export function useAgences(params?: {
  recherche?: string;
  actifSeulement?: boolean;
  page?: number;
  size?: number;
}) {
  const recherche = params?.recherche?.trim() || undefined;
  const actifSeulement = params?.actifSeulement ?? true;
  return useQuery({
    queryKey: [CLES.agences, recherche ?? "", actifSeulement, params?.page ?? 0, params?.size ?? null],
    queryFn: () =>
      referentielService.agences({
        recherche,
        actifSeulement,
        page: params?.page,
        size: params?.size,
      }),
    staleTime: FRAICHEUR_REFERENTIEL,
  });
}

/**
 * Create, update, close and reopen a branch (DJ/DJA). All four invalidate the same key, since the
 * admin list and input pickers read the same reference data.
 */
export function useEcritureAgence() {
  const client = useQueryClient();
  const invalider = () => client.invalidateQueries({ queryKey: [CLES.agences] });

  const creer = useMutation({
    mutationFn: (corps: AgenceEcriture) => referentielService.creerAgence(corps),
    onSuccess: invalider,
  });
  const modifier = useMutation({
    mutationFn: ({ id, corps }: { id: number; corps: AgenceEcriture }) =>
      referentielService.modifierAgence(id, corps),
    onSuccess: invalider,
  });
  const desactiver = useMutation({
    mutationFn: (id: number) => referentielService.desactiverAgence(id),
    onSuccess: invalider,
  });
  // Close and reopen are separate mutations, not a toggle, so the screen can track and report
  // each one independently.
  const reactiver = useMutation({
    mutationFn: (id: number) => referentielService.reactiverAgence(id),
    onSuccess: invalider,
  });

  return { creer, modifier, desactiver, reactiver };
}

/** Case natures, filterable by category so the form adapts to the selected category. */
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

/** Internal user directory. `profil` filters by profile code (`JURISTE`, `DJ`, ...). */
export function useUtilisateurs(profil?: string) {
  return useQuery({
    queryKey: [CLES.utilisateurs, profil ?? "tous"],
    queryFn: () => referentielService.utilisateurs(profil ? { profil } : undefined),
    staleTime: FRAICHEUR_REFERENTIEL,
  });
}
