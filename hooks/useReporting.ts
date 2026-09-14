"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { CLES } from "@/hooks/const";
import { reportingService, type PeriodeRapport } from "@/services/reportingService";

/**
 * Le tableau de bord annonce des indicateurs « temps réel » (RG-REP-03). Les recalculer à chaque
 * montage ne suffit pas : l'écran reste ouvert. Un rafraîchissement périodique les tient à jour
 * sans que le DJ ait à recharger, et la fenêtre reprend la main au retour sur l'onglet.
 */
export const CADENCE_TABLEAU_DE_BORD = 60 * 1000;

export function useTableauDeBord() {
  return useQuery({
    queryKey: [CLES.tableauDeBord],
    queryFn: () => reportingService.tableauDeBord(),
    refetchInterval: CADENCE_TABLEAU_DE_BORD,
    refetchOnWindowFocus: true,
  });
}

/**
 * Un rapport est une **action**, pas une lecture d'écran : il se demande pour une période choisie,
 * et rien ne doit partir avant que l'utilisateur ait cliqué. D'où une mutation plutôt qu'une
 * requête — la différence se voit à l'usage, une requête se relancerait à chaque changement de
 * borne.
 *
 * `null` en résultat signifie **204** : aucune activité sur la période.
 */
export function useGenererRapport() {
  return useMutation({
    mutationFn: (periode: PeriodeRapport) => reportingService.genererRapport(periode),
  });
}
