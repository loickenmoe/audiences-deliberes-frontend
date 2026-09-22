"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { CLES, FRAICHEUR_REFERENTIEL, TAILLE_PAGE } from "@/hooks/const";
import { intervenantService } from "@/services/intervenantService";
import type { CreerIntervenant, ModifierIntervenant } from "@/types/domaine";
import type { TypeIntervenant } from "@/types/enums";

/**
 * Le référentiel des intervenants, paginé et cherchable (Q-100/Q-105).
 *
 * ⚠ Cet endpoint sert **trois** usages qu'il ne faut pas confondre : le tableau de l'écran 42 (dix
 * lignes), les **sélecteurs** d'affectation et de constitution (recherche au fil de la frappe), et
 * la **table de correspondance** de `useLibelles`, qui a besoin de tout l'annuaire. Chacun dit
 * explicitement ce qu'il veut — c'est la seule façon de ne pas tronquer l'un en réglant l'autre.
 */
export function useIntervenants(
  params: { type?: TypeIntervenant; nom?: string; page?: number; size?: number } = {},
) {
  return useQuery({
    queryKey: [
      CLES.intervenants,
      params.type ?? "tous",
      params.nom ?? "",
      params.page ?? 0,
      params.size ?? TAILLE_PAGE,
    ],
    queryFn: () => intervenantService.lister(params),
    staleTime: FRAICHEUR_REFERENTIEL,
  });
}

export function useCreerIntervenant() {
  const queryClient = useQueryClient();
  const t = useTranslations("intervenants");

  return useMutation({
    mutationFn: (corps: CreerIntervenant) => intervenantService.creer(corps),
    onSuccess: () => {
      // Toutes les variantes de filtre sont invalidées : un nouvel avocat doit apparaître aussi
      // bien dans la liste filtrée que dans les sélecteurs d'affectation d'un dossier.
      void queryClient.invalidateQueries({ queryKey: [CLES.intervenants] });
      toast.success(t("creationReussie"));
    },
  });
}

export function useModifierIntervenant(id: number) {
  const queryClient = useQueryClient();
  const t = useTranslations("intervenants");

  return useMutation({
    mutationFn: (corps: ModifierIntervenant) => intervenantService.modifier(id, corps),
    onSuccess: () => {
      // Le nom corrigé doit apparaître partout : référentiel, sélecteurs d'affectation, constitutions.
      void queryClient.invalidateQueries({ queryKey: [CLES.intervenants] });
      toast.success(t("modificationReussie"));
    },
  });
}
