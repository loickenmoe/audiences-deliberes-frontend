"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES, TAILLE_PAGE } from "@/hooks/const";
import { useCanalAlertes } from "@/providers/alertes.provider";
import { alerteService } from "@/services/alerteService";
import type { StatutAlerte, TypeAlerte } from "@/types/enums";

/**
 * HTTP fallback for the real-time channel. When the channel is open, pushed alerts already
 * invalidate the query; polling still covers a SockJS transport that freezes without closing, so
 * no notification is missed for long. When the channel is closed, polling is the only path and
 * runs faster.
 */
export const CADENCE_CANAL_OUVERT = 60 * 1000;
export const CADENCE_REPLI = 30 * 1000;

export function cadenceRafraichissement(canal: { connecte: boolean }): number {
  return canal.connecte ? CADENCE_CANAL_OUVERT : CADENCE_REPLI;
}

/** `null`: both statuses. */
export function useMesNotifications(
  statut: StatutAlerte | null,
  page = 0,
  size = TAILLE_PAGE,
  type?: TypeAlerte,
) {
  const canal = useCanalAlertes();
  return useQuery({
    queryKey: [CLES.notifications, statut ?? "toutes", page, size, type ?? "tous"],
    queryFn: () => alerteService.mesNotifications(statut, page, size, type),
    refetchInterval: cadenceRafraichissement(canal),
  });
}

/**
 * Header counter: a one-element page is enough since `totalElements` carries the count. Kept
 * separate from the queue so the badge is independent of the queue's pagination.
 */
export function useNombreNotificationsATraiter() {
  const canal = useCanalAlertes();
  return useQuery({
    queryKey: [CLES.notifications, "compteur"],
    queryFn: () => alerteService.mesNotifications("DECLENCHEE", 0, 1),
    refetchInterval: cadenceRafraichissement(canal),
    select: (page) => page.totalElements,
  });
}

/**
 * #51: in-app channel delivery rate (NF-ALR-02), DJ and DJA. No automatic refresh: it is an
 * operational metric over a multi-day window that does not change meaningfully in seconds.
 */
export function useStatistiquesDiffusion(dateDebut: string, dateFin: string, actif = true) {
  return useQuery({
    queryKey: [CLES.notifications, "diffusion", dateDebut, dateFin],
    queryFn: () => alerteService.statistiquesDiffusion(dateDebut, dateFin),
    enabled: actif && Boolean(dateDebut) && Boolean(dateFin),
  });
}

/** #46: the backend rejects (403) a caller who is not the recipient. */
export function useTraiterAlerte() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => alerteService.traiter(id),
    onSuccess: () => client.invalidateQueries({ queryKey: [CLES.notifications] }),
  });
}

