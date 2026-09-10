"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { CLES } from "@/hooks/const";
import { dossierService } from "@/services/dossierService";
import { gedService } from "@/services/gedService";
import type {
  CreerDossier,
  DemandeDerogation,
  FiltresDossiers,
  ModifierAffectation,
  ValiderDerogation,
  ValiderSensibilite,
} from "@/types/domaine";
import type { StatutCycleVie, StatutValidation, TypeEtape } from "@/types/enums";

/**
 * Liste paginée des dossiers.
 *
 * Les filtres entrent dans la clé de cache : deux recherches différentes ne doivent pas se
 * recouvrir, sinon la seconde afficherait brièvement les résultats de la première.
 */
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

export function useDocumentsDossier(id: number) {
  return useQuery({
    queryKey: [CLES.documentsDossier, id],
    queryFn: () => gedService.listerDocumentsDossier(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}

export function useCreerDossier() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dossier: CreerDossier) => dossierService.creer(dossier),
    onSuccess: (cree) => {
      // Toutes les listes sont invalidées, quels que soient leurs filtres : le nouveau dossier peut
      // apparaître dans plusieurs d'entre elles.
      void client.invalidateQueries({ queryKey: [CLES.dossiers] });
      // La vue consolidée du client gagne une ligne.
      void client.invalidateQueries({ queryKey: [CLES.clientDossiers, cree.clientId] });
    },
  });
}

/**
 * Toute action sur la fiche rafraîchit la fiche **et** les listes : l'étape courante et le statut
 * de sensibilité y sont affichés, et deviendraient faux sans invalidation.
 *
 * Seul le succès est notifié ici. Les erreurs restent aux écrans : un `ERR-003` n'est pas un
 * échec mais une demande de confirmation, et un toast d'erreur le présenterait à tort comme tel.
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
      // Une demande ou un arbitrage de dérogation modifie la file d'arbitrage du dossier.
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

/** File des demandes de seuil d'un dossier (Q-74). `actif` évite l'appel quand il est inutile. */
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
 * Dépôt et suppression de pièces. Pas de notification ici : à la création d'un dossier, plusieurs
 * pièces partent d'affilée, et un toast par pièce noierait l'utilisateur. Les écrans notifient.
 * La fiche est rafraîchie aussi : chaque dépôt ou suppression entre dans l'historique.
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
