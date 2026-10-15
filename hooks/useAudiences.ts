"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES, TAILLE_PAGE } from "@/hooks/const";
import { audienceService } from "@/services/audienceService";
import type { CreerAlarme, PlanifierAudience, ReprogrammerAlarme } from "@/types/domaine";
import type { PeriodeCalendrier } from "@/types/enums";

export function useAudiencesDossier(dossierId: number, page = 0, size = TAILLE_PAGE) {
  return useQuery({
    queryKey: [CLES.audiencesDossier, dossierId, page, size],
    queryFn: () => audienceService.listerAudiences(dossierId, page, size),
    enabled: Number.isFinite(dossierId) && dossierId > 0,
  });
}

export function useAlarmesDossier(dossierId: number, page = 0, size = TAILLE_PAGE) {
  return useQuery({
    queryKey: [CLES.alarmesDossier, dossierId, page, size],
    queryFn: () => audienceService.listerAlarmes(dossierId, page, size),
    enabled: Number.isFinite(dossierId) && dossierId > 0,
  });
}

/**
 * Écran 44 — le journal d'une journée. La donnée précédente reste affichée pendant le chargement
 * d'une autre date : sans cela, changer de jour vide le tableau puis le remplit, ce qui donne
 * l'impression d'une journée sans audience.
 */
export function useJournalAudiences(date: string, page = 0, size = TAILLE_PAGE) {
  return useQuery({
    queryKey: [CLES.journalAudiences, date, page, size],
    queryFn: () => audienceService.journal(date, page, size),
    enabled: /^\d{4}-\d{2}-\d{2}$/.test(date),
    placeholderData: (precedent) => precedent,
  });
}

/** Écran 44 — les comptes rendus qui manquent encore, sur une fenêtre choisie. */
export function useComptesRendusAttendus(dateDebut: string, dateFin: string, page = 0, size = TAILLE_PAGE) {
  return useQuery({
    queryKey: [CLES.comptesRendusAttendus, dateDebut, dateFin, page, size],
    queryFn: () => audienceService.comptesRendusAttendus(dateDebut, dateFin, page, size),
    enabled: /^\d{4}-\d{2}-\d{2}$/.test(dateDebut) && /^\d{4}-\d{2}-\d{2}$/.test(dateFin),
    placeholderData: (precedent) => precedent,
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

/** QF-64 — la note destinée à l'avocat constitué. */
export function useModifierNoteAvocat(dossierId: number) {
  const invalider = useInvalidation(dossierId, CLES.audiencesDossier);
  return useMutation({
    mutationFn: ({ audienceId, note }: { audienceId: number; note: string }) =>
      audienceService.modifierNoteAvocat(audienceId, note),
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
