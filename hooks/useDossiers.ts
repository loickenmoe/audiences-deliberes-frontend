"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { CLES, TAILLE_PAGE } from "@/hooks/const";
import { dossierService } from "@/services/dossierService";
import { gedService } from "@/services/gedService";
import type {
  CreerDossier,
  DemandeDerogation,
  FiltresDossiers,
  ModifierAffectation,
  ValiderDerogation,
  ModifierDiligence,
  ProposerDiligence,
  ValiderSensibilite,
} from "@/types/domaine";
import type { StatutCycleVie, StatutValidation, TypeEtape } from "@/types/enums";

/** Paginated case list. Filters are part of the cache key so that searches never overlap. */
export function useDossiers(filtres: FiltresDossiers = {}) {
  return useQuery({
    queryKey: [CLES.dossiers, filtres],
    queryFn: () => dossierService.lister(filtres),
  });
}

export function useDossier(id: number) {
  return useQuery({
    queryKey: [CLES.dossier, id],
    queryFn: () => dossierService.consulter(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}

/** Paginated case history; the case record only carries the first page. */
export function useHistoriqueDossier(dossierId: number, page = 0, size = TAILLE_PAGE) {
  return useQuery({
    queryKey: [CLES.dossier, dossierId, "historique", page, size],
    queryFn: () => dossierService.historique(dossierId, page, size),
  });
}

export function useDocumentsDossier(id: number, page = 0, size = TAILLE_PAGE) {
  return useQuery({
    queryKey: [CLES.documentsDossier, id, page, size],
    queryFn: () => gedService.listerDocumentsDossier(id, page, size),
    enabled: Number.isFinite(id) && id > 0,
  });
}

export function useCreerDossier() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dossier: CreerDossier) => dossierService.creer(dossier),
    onSuccess: (cree) => {
      // Invalidate every list regardless of filters: the new case may appear in several.
      void client.invalidateQueries({ queryKey: [CLES.dossiers] });
      // The client's consolidated view gains a row.
      void client.invalidateQueries({ queryKey: [CLES.clientDossiers, cree.clientId] });
    },
  });
}

/**
 * Any action on the case record refreshes the record and the lists, which show the current step
 * and sensitivity status. Only success is notified here: `ERR-003` is a confirmation request, not
 * a failure, so errors are left to the screens.
 */
function useMutationFiche<TVariables, TResultat>(
  id: number,
  appel: (variables: TVariables) => Promise<TResultat>,
  cleSucces: string,
) {
  const client = useQueryClient();
  const t = useTranslations("fiche");
  return useMutation({
    mutationFn: appel,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [CLES.dossier, id] });
      void client.invalidateQueries({ queryKey: [CLES.dossiers] });
      // A derogation request or decision changes the case's arbitration queue.
      void client.invalidateQueries({ queryKey: [CLES.derogations, id] });
      toast.success(t(cleSucces as never));
    },
  });
}

export function useModifierAffectation(id: number) {
  return useMutationFiche(
    id,
    ({ affectation, forcer }: { affectation: ModifierAffectation; forcer?: boolean }) =>
      dossierService.modifierAffectation(id, affectation, forcer),
    "affectationEnregistree",
  );
}

export function useModifierStatutEtape(id: number) {
  return useMutationFiche(
    id,
    ({ etapeId, nouveauStatut }: { etapeId: number; nouveauStatut: StatutCycleVie }) =>
      dossierService.modifierStatutEtape(id, etapeId, nouveauStatut),
    "statutEnregistre",
  );
}

export function useCreerEtape(id: number) {
  return useMutationFiche(id, (type: TypeEtape) => dossierService.creerEtape(id, type), "etapeCreee");
}

export function useDemanderDerogation(id: number) {
  return useMutationFiche(
    id,
    (demande: DemandeDerogation) => dossierService.demanderDerogation(id, demande),
    "derogationEnvoyee",
  );
}

export function useValiderSensibilite(id: number) {
  return useMutationFiche(
    id,
    (decision: ValiderSensibilite) => dossierService.validerSensibilite(id, decision),
    "sensibiliteEnregistree",
  );
}

/** The legal officer proposes special diligence on an already open case. */
export function useProposerDiligence(id: number) {
  return useMutationFiche(
    id,
    (demande: ProposerDiligence) => dossierService.proposerDiligence(id, demande),
    "diligenceProposee",
  );
}

/**
 * The DJ or DJA sets or lifts special diligence directly. One mutation for both directions, since
 * it is a single endpoint.
 */
export function useModifierDiligence(id: number) {
  return useMutationFiche(
    id,
    (modification: ModifierDiligence) => dossierService.modifierDiligence(id, modification),
    "diligenceModifiee",
  );
}

/** Threshold derogation requests of a case. `actif` skips the call when it is not needed. */
export function useDerogations(id: number, statut?: StatutValidation, actif = true) {
  return useQuery({
    queryKey: [CLES.derogations, id, statut ?? "toutes"],
    queryFn: () => dossierService.listerDerogations(id, statut),
    enabled: actif && Number.isFinite(id) && id > 0,
  });
}

export function useValiderDerogation(id: number) {
  return useMutationFiche(
    id,
    ({ auditId, decision }: { auditId: number; decision: ValiderDerogation }) =>
      dossierService.validerDerogation(id, auditId, decision),
    "derogationArbitree",
  );
}

/**
 * Document upload and deletion. No toast here, since case creation uploads several documents in a
 * row; screens notify. The case record is refreshed too, as each action enters its history.
 */
function useInvalidationDocuments(dossierId: number) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: [CLES.documentsDossier, dossierId] });
    void client.invalidateQueries({ queryKey: [CLES.dossier, dossierId] });
  };
}

export function useDeposerDocument(dossierId: number) {
  const invalider = useInvalidationDocuments(dossierId);
  return useMutation({
    mutationFn: ({ typeDocument, fichier }: { typeDocument: string; fichier: File }) =>
      gedService.deposer(dossierId, typeDocument, fichier),
    onSuccess: invalider,
  });
}

export function useSupprimerDocument(dossierId: number) {
  const invalider = useInvalidationDocuments(dossierId);
  return useMutation({
    mutationFn: (documentId: number) => gedService.supprimer(documentId),
    onSuccess: invalider,
  });
}
