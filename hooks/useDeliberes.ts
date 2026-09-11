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

/** Chargé à la demande : l'historique ne s'affiche que si on l'ouvre. */
export function useProrogations(delibereId: number | null) {
  return useQuery({
    queryKey: [CLES.prorogations, delibereId],
    queryFn: () => delibereService.listerProrogations(delibereId as number),
    enabled: delibereId !== null,
  });
}

/** `actif` : le suivi n'a de sens que pour une décision qui ouvre une voie de recours. */
export function useRecours(delibereId: number, actif: boolean) {
  return useQuery({
    queryKey: [CLES.recours, delibereId],
    queryFn: () => delibereService.recours(delibereId),
    enabled: actif,
  });
}

/**
 * Invalidation commune : chaque action sur un délibéré peut changer le statut de l'étape (donc la
 * fiche et son historique), la liste des délibérés, leurs prorogations et le suivi du recours.
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
