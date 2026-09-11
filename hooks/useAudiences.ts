"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES } from "@/hooks/const";
import { audienceService } from "@/services/audienceService";
import type { CreerAlarme, PlanifierAudience, ReprogrammerAlarme } from "@/types/domaine";
import type { PeriodeCalendrier } from "@/types/enums";

export function useAudiencesDossier(dossierId: number) {
  return useQuery({
    queryKey: [CLES.audiencesDossier, dossierId],
    queryFn: () => audienceService.listerAudiences(dossierId),
    enabled: Number.isFinite(dossierId) && dossierId > 0,
  });
}

export function useAlarmesDossier(dossierId: number) {
  return useQuery({
    queryKey: [CLES.alarmesDossier, dossierId],
    queryFn: () => audienceService.listerAlarmes(dossierId),
    enabled: Number.isFinite(dossierId) && dossierId > 0,
  });
}

export function useCalendrier(periode: PeriodeCalendrier, dateDebut: string) {
  return useQuery({
    queryKey: [CLES.calendrier, periode, dateDebut],
    queryFn: () => audienceService.calendrier(periode, dateDebut),
    // Garder la période affichée pendant le chargement de la suivante : sans cela, l'écran clignote
    // à chaque clic sur « suivante ».
    placeholderData: (precedent) => precedent,
  });
}

/**
 * Invalidation commune : une audience ou une alarme modifie la fiche (historique), sa liste, et le
 * calendrier. Les notifications de succès restent aux écrans — un `ERR-005` n'est pas un échec mais
 * une demande de confirmation, qu'un toast d'erreur présenterait à tort comme tel.
 */
function useInvalidation(dossierId: number, cleListe: string) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: [cleListe, dossierId] });
    void client.invalidateQueries({ queryKey: [CLES.dossier, dossierId] });
    void client.invalidateQueries({ queryKey: [CLES.calendrier] });
  };
}

export function usePlanifierAudience(dossierId: number) {
  const invalider = useInvalidation(dossierId, CLES.audiencesDossier);
  return useMutation({
    mutationFn: ({ audience, forcer }: { audience: PlanifierAudience; forcer?: boolean }) =>
      audienceService.planifier(dossierId, audience, forcer),
    onSuccess: invalider,
  });
}

export function useEnregistrerCompteRendu(dossierId: number) {
  const invalider = useInvalidation(dossierId, CLES.audiencesDossier);
  return useMutation({
    mutationFn: ({ audienceId, compteRendu }: { audienceId: number; compteRendu: string }) =>
      audienceService.enregistrerCompteRendu(audienceId, compteRendu),
    onSuccess: invalider,
  });
}

export function useAnnulerAudience(dossierId: number) {
  const invalider = useInvalidation(dossierId, CLES.audiencesDossier);
  return useMutation({
    mutationFn: ({ audienceId, motif }: { audienceId: number; motif: string }) =>
      audienceService.annuler(audienceId, motif),
    onSuccess: invalider,
  });
}

export function useTraiterAlarme(dossierId: number) {
  const invalider = useInvalidation(dossierId, CLES.alarmesDossier);
  return useMutation({
    mutationFn: (alarmeId: number) => audienceService.traiterAlarme(alarmeId),
    onSuccess: invalider,
  });
}

export function useCreerAlarme(dossierId: number) {
  const invalider = useInvalidation(dossierId, CLES.alarmesDossier);
  return useMutation({
    mutationFn: (alarme: CreerAlarme) => audienceService.creerAlarme(dossierId, alarme),
    onSuccess: invalider,
  });
}

export function useReprogrammerAlarme(dossierId: number) {
  const invalider = useInvalidation(dossierId, CLES.alarmesDossier);
  return useMutation({
    mutationFn: ({ alarmeId, reprogrammation }: { alarmeId: number; reprogrammation: ReprogrammerAlarme }) =>
      audienceService.reprogrammerAlarme(alarmeId, reprogrammation),
    onSuccess: invalider,
  });
}
