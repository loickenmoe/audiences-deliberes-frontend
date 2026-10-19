"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES, FRAICHEUR_REFERENTIEL } from "@/hooks/const";
import { fraisService } from "@/services/fraisService";
import { portailAvocatService } from "@/services/portailAvocatService";
import { publicationService } from "@/services/publicationService";
import type { DeposerCompteRendu, DeposerFrais } from "@/types/domaine";
import type { TypeAutrePublication } from "@/types/enums";

/**
 * The lawyer's cases, optionally searched by reference. Long cache: the list feeds a picker and
 * only changes with assignment decisions. The search term is part of the cache key, and the
 * previous list stays displayed while the next one loads.
 */
export function useMesDossiers(reference?: string) {
  return useQuery({
    queryKey: [CLES.mesDossiers, reference ?? ""],
    queryFn: () => portailAvocatService.mesDossiers(reference),
    staleTime: FRAICHEUR_REFERENTIEL,
    placeholderData: (precedent) => precedent,
  });
}

/**
 * Hearings of one of the lawyer's cases. `enabled` prevents calling
 * `/avocat/mes-dossiers/undefined/audiences` before a case is selected.
 */
export function useAudiencesDeMonDossier(dossierId: number | null) {
  return useQuery({
    queryKey: [CLES.mesAudiences, dossierId],
    queryFn: () => portailAvocatService.audiencesDeMonDossier(dossierId!),
    enabled: dossierId !== null,
  });
}

/** Shared documents of one of the lawyer's cases; nothing is fetched until a case is selected. */
export function usePiecesDeMonDossier(dossierId: number | null) {
  return useQuery({
    queryKey: [CLES.piecesDossierAvocat, dossierId],
    queryFn: () => portailAvocatService.piecesDeMonDossier(dossierId!),
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

/** #23: submits an expense request; its queue (#28) is refreshed. */
export function useDeposerFrais() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (demande: DeposerFrais) => fraisService.deposer(demande),
    onSuccess: () => client.invalidateQueries({ queryKey: [CLES.demandesFrais] }),
  });
}

/** #29: submits a hearing report with its optional attachment. */
export function useDeposerCompteRendu() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (depot: DeposerCompteRendu & { fichier?: File | null }) =>
      publicationService.deposerCompteRendu(depot, depot.fichier),
    onSuccess: () => client.invalidateQueries({ queryKey: [CLES.mesPublications] }),
  });
}

/** #31: submits a document, decision or submission brief (multipart). */
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
