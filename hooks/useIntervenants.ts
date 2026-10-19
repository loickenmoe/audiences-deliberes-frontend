"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { CLES, FRAICHEUR_REFERENTIEL, TAILLE_PAGE } from "@/hooks/const";
import { intervenantService } from "@/services/intervenantService";
import type { CreerIntervenant, ModifierIntervenant } from "@/types/domaine";
import type { TypeIntervenant } from "@/types/enums";

/**
 * Paginated, searchable stakeholder directory. This endpoint serves three distinct uses: the
 * screen 42 table, the assignment/constitution pickers (search-as-you-type), and the `useLibelles`
 * lookup table, which needs the whole directory. Each caller states its own paging explicitly.
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
      // Invalidate every filter variant: a new lawyer must appear in the filtered list and in the
      // case assignment pickers.
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
      // The corrected name must appear everywhere: directory, assignment pickers, constitutions.
      void queryClient.invalidateQueries({ queryKey: [CLES.intervenants] });
      toast.success(t("modificationReussie"));
    },
  });
}
