"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { CLES, FRAICHEUR_REFERENTIEL } from "@/hooks/const";
import { intervenantService } from "@/services/intervenantService";
import type { CreerIntervenant } from "@/types/domaine";
import type { TypeIntervenant } from "@/types/enums";

export function useIntervenants(type?: TypeIntervenant) {
  return useQuery({
    queryKey: [CLES.intervenants, type ?? "tous"],
    queryFn: () => intervenantService.lister(type),
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
