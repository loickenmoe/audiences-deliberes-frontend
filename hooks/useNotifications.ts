"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES } from "@/hooks/const";
import { notificationService } from "@/services/notificationService";

/** Monitoring of external notifications over a time window. */
export function useSupervisionNotifications(dateDebut: string, dateFin: string, actif = true) {
  return useQuery({
    queryKey: [CLES.notifications, "supervision", dateDebut, dateFin],
    queryFn: () => notificationService.superviser(dateDebut, dateFin),
    enabled: actif && Boolean(dateDebut) && Boolean(dateFin),
  });
}

/**
 * Retries an abandoned delivery. Monitoring is invalidated afterwards: the retried row leaves the
 * list of deliveries to review and its channel recounts its states.
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
