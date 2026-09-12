"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES } from "@/hooks/const";
import { useCanalAlertes } from "@/providers/alertes.provider";
import { alerteService } from "@/services/alerteService";
import type { StatutAlerte } from "@/types/enums";

/**
 * Repli HTTP du canal temps réel (QF-11).
 *
 * Canal ouvert, la liste n'a pas à interroger le backend : chaque alerte poussée invalide déjà
 * cette requête. Le rafraîchissement lent qui subsiste couvre le cas où le canal se croit ouvert
 * alors que plus rien ne passe. Canal fermé, la cadence se resserre — c'est le seul chemin
 * restant, et le backend a de toute façon enregistré l'alerte.
 */
export const CADENCE_CANAL_OUVERT = 5 * 60 * 1000;
export const CADENCE_REPLI = 30 * 1000;

export function cadenceRafraichissement(connecte: boolean): number {
  return connecte ? CADENCE_CANAL_OUVERT : CADENCE_REPLI;
}

/** `null` : les deux statuts confondus. */
export function useMesNotifications(statut: StatutAlerte | null, page = 0, size = 20) {
  const { connecte } = useCanalAlertes();
  return useQuery({
    queryKey: [CLES.notifications, statut ?? "toutes", page, size],
    queryFn: () => alerteService.mesNotifications(statut, page, size),
    refetchInterval: cadenceRafraichissement(connecte),
  });
}

/**
 * Compteur de l'en-tête : une page d'un seul élément suffit, `totalElements` porte le nombre.
 * Volontairement dissocié de la file — le badge suit l'utilisateur sur toutes les pages, la file
 * garde sa pagination.
 */
export function useNombreNotificationsATraiter() {
  const { connecte } = useCanalAlertes();
  return useQuery({
    queryKey: [CLES.notifications, "compteur"],
    queryFn: () => alerteService.mesNotifications("DECLENCHEE", 0, 1),
    refetchInterval: cadenceRafraichissement(connecte),
    select: (page) => page.totalElements,
  });
}

/** #46 — le backend refuse (403) si l'appelant n'est pas le destinataire. */
export function useTraiterAlerte() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => alerteService.traiter(id),
    onSuccess: () => client.invalidateQueries({ queryKey: [CLES.notifications] }),
  });
}

