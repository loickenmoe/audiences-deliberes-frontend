"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES, FRAICHEUR_REFERENTIEL } from "@/hooks/const";
import { referentielService } from "@/services/referentielService";
import type { AgenceEcriture } from "@/types/domaine";
import type { CategorieDossier } from "@/types/enums";

/**
 * Agences de la banque, **cherchées côté serveur** (métier, 2026-10-03, observation 2).
 *
 * `recherche` entre dans la clé de cache : chaque saisie a sa réponse, et revenir sur une saisie
 * déjà faite n'interroge pas le serveur. La fraîcheur longue des référentiels s'applique - une
 * agence ouvre ou ferme au rythme d'une décision de la direction, pas d'une session de travail.
 *
 * `actifSeulement` à faux n'a de sens que pour l'écran d'administration : ailleurs, proposer une
 * agence fermée ferait saisir un code que le backend refuse.
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
 * Création, modification, fermeture et réouverture d'une agence (DJ/DJA).
 *
 * Les quatre invalident la même clé : la liste d'administration et les sélecteurs de saisie
 * lisent le même référentiel, et une agence créée ou rouverte doit être proposable sans
 * rechargement de page.
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
  // Fermer et rouvrir sont deux mutations, non un bascule : l'écran doit pouvoir désactiver l'une
  // pendant que l'autre travaille, et nommer celle qui a échoué.
  const reactiver = useMutation({
    mutationFn: (id: number) => referentielService.reactiverAgence(id),
    onSuccess: invalider,
  });

  return { creer, modifier, desactiver, reactiver };
}

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
