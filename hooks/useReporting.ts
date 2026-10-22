"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { CLES } from "@/hooks/const";
import { reportingService, type PeriodeRapport } from "@/services/reportingService";
import type { CategorieDossier } from "@/types/enums";

/**
 * The dashboard shows "real-time" indicators (RG-REP-03). Since the screen stays open, a periodic
 * refresh keeps them current, and returning to the tab also refetches.
 */
export const CADENCE_TABLEAU_DE_BORD = 60 * 1000;

export function useTableauDeBord(categorie?: CategorieDossier) {
  return useQuery({
    // The scope is part of the key so that switching category never shows the previous figures.
    queryKey: [CLES.tableauDeBord, categorie ?? "TOUTES"],
    queryFn: () => reportingService.tableauDeBord(categorie),
    refetchInterval: CADENCE_TABLEAU_DE_BORD,
    refetchOnWindowFocus: true,
  });
}

/**
 * A report is an explicit action for a chosen period, hence a mutation rather than a query (which
 * would refetch on every bound change). A `null` result means 204: no activity in the period.
 */
export function useGenererRapport() {
  return useMutation({
    mutationFn: (periode: PeriodeRapport) => reportingService.genererRapport(periode),
  });
}
