"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES, FRAICHEUR_REFERENTIEL } from "@/hooks/const";
import { fraisService } from "@/services/fraisService";
import { portailAvocatService } from "@/services/portailAvocatService";
import { publicationService } from "@/services/publicationService";
import type { DeposerCompteRendu, DeposerFrais } from "@/types/domaine";
import type { TypeAutrePublication } from "@/types/enums";

/**
 * Ses dossiers. Cache long : la liste alimente un sélecteur et ne change qu'au rythme d'une
 * décision d'affectation, pas d'une session de travail.
 */
export function useMesDossiers() {
  return useQuery({
    queryKey: [CLES.mesDossiers],
    queryFn: () => portailAvocatService.mesDossiers(),
    staleTime: FRAICHEUR_REFERENTIEL,
  });
}

/**
 * Les audiences d'un de ses dossiers. `enabled` évite un appel tant qu'aucun dossier n'est choisi —
 * sans lui, l'écran interrogerait `/avocat/mes-dossiers/undefined/audiences` au premier rendu.
 */
export function useAudiencesDeMonDossier(dossierId: number | null) {
  return useQuery({
    queryKey: [CLES.mesAudiences, dossierId],
    queryFn: () => portailAvocatService.audiencesDeMonDossier(dossierId!),
    enabled: dossierId !== null,
  });
}

export function useMesPublications(page = 0) {
  return useQuery({
    queryKey: [CLES.mesPublications, page],
    queryFn: () => portailAvocatService.mesPublications(page),
  });
}

export function useMesConstitutions() {
  return useQuery({
    queryKey: [CLES.mesConstitutions],
    queryFn: () => portailAvocatService.mesConstitutions(),
  });
}

/** #23 — dépôt d'une demande de frais. Sa file (#28) la montrera aussitôt. */
export function useDeposerFrais() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (demande: DeposerFrais) => fraisService.deposer(demande),
    onSuccess: () => client.invalidateQueries({ queryKey: [CLES.demandesFrais] }),
  });
}

/** #29 — dépôt d'un compte rendu d'audience. */
export function useDeposerCompteRendu() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (depot: DeposerCompteRendu) => publicationService.deposerCompteRendu(depot),
    onSuccess: () => client.invalidateQueries({ queryKey: [CLES.mesPublications] }),
  });
}

/** #31 — dépôt d'une pièce, d'une décision ou d'une conclusion (multipart). */
export function useDeposerAutrePublication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (depot: {
      dossierId: number;
      typeDocument: TypeAutrePublication;
      fichier: File;
      restrictionAcces?: number;
    }) =>
      publicationService.deposerAutre(
        depot.dossierId,
        depot.typeDocument,
        depot.fichier,
        depot.restrictionAcces,
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: [CLES.mesPublications] }),
  });
}
