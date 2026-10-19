"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES } from "@/hooks/const";
import { delibereService } from "@/services/delibereService";
import type { EnregistrerDelibere, ProrogerDelibere, RabattreDelibere, ViderDelibere } from "@/types/domaine";
import type { StatutExpedition } from "@/types/enums";

export function useDeliberesDossier(dossierId: number) {
  return useQuery({
    queryKey: [CLES.deliberesDossier, dossierId],
    queryFn: () => delibereService.lister(dossierId),
    enabled: Number.isFinite(dossierId) && dossierId > 0,
  });
}

/** Loaded on demand: the history is only shown when opened. */
export function useProrogations(delibereId: number | null) {
  return useQuery({
    queryKey: [CLES.prorogations, delibereId],
    queryFn: () => delibereService.listerProrogations(delibereId as number),
    enabled: delibereId !== null,
  });
}

/** `actif`: tracking only makes sense for a decision that opens a means of appeal. */
export function useRecours(delibereId: number, actif: boolean) {
  return useQuery({
    queryKey: [CLES.recours, delibereId],
    queryFn: () => delibereService.recours(delibereId),
    enabled: actif,
  });
}

/**
 * Shared invalidation: any action on a deliberation may change the step status (hence the case
 * record and its history), the deliberation list, their extensions and appeal tracking.
 */
function useInvalidation(dossierId: number) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: [CLES.deliberesDossier, dossierId] });
    void client.invalidateQueries({ queryKey: [CLES.dossier, dossierId] });
    void client.invalidateQueries({ queryKey: [CLES.prorogations] });
    void client.invalidateQueries({ queryKey: [CLES.recours] });
  };
}

export function useEnregistrerDelibere(dossierId: number) {
  const invalider = useInvalidation(dossierId);
  return useMutation({
    mutationFn: (corps: EnregistrerDelibere) => delibereService.enregistrer(dossierId, corps),
    onSuccess: invalider,
  });
}

export function useViderDelibere(dossierId: number) {
  const invalider = useInvalidation(dossierId);
  return useMutation({
    mutationFn: ({ delibereId, corps }: { delibereId: number; corps: ViderDelibere }) =>
      delibereService.vider(delibereId, corps),
    onSuccess: invalider,
  });
}

export function useProroger(dossierId: number) {
  const invalider = useInvalidation(dossierId);
  return useMutation({
    mutationFn: ({ delibereId, corps }: { delibereId: number; corps: ProrogerDelibere }) =>
      delibereService.proroger(delibereId, corps),
    onSuccess: invalider,
  });
}

export function useRabattre(dossierId: number) {
  const invalider = useInvalidation(dossierId);
  return useMutation({
    mutationFn: ({ delibereId, corps }: { delibereId: number; corps: RabattreDelibere }) =>
      delibereService.rabattre(delibereId, corps),
    onSuccess: invalider,
  });
}

export function useModifierExpedition(dossierId: number) {
  const invalider = useInvalidation(dossierId);
  return useMutation({
    mutationFn: ({ delibereId, statut }: { delibereId: number; statut: StatutExpedition }) =>
      delibereService.modifierExpedition(delibereId, statut),
    onSuccess: invalider,
  });
}
