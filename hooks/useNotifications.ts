"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES } from "@/hooks/const";
import { notificationService } from "@/services/notificationService";

/** Supervision des notifications externes sur une fenêtre (D17). */
export function useSupervisionNotifications(dateDebut: string, dateFin: string, actif = true) {
  return useQuery({
    queryKey: [CLES.notifications, "supervision", dateDebut, dateFin],
    queryFn: () => notificationService.superviser(dateDebut, dateFin),
    enabled: actif && Boolean(dateDebut) && Boolean(dateFin),
  });
}

/**
 * Relance d'un envoi abandonné. La supervision est invalidée après coup : la ligne relancée quitte
 * la liste des envois à examiner, et son canal recompte ses états.
 */
export function useRelancerNotification() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => notificationService.relancer(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [CLES.notifications, "supervision"] });
    },
  });
}
