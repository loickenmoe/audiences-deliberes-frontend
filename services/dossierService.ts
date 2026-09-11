import { apiClient, type PageReponse } from "@/lib/api/client";
import type {
  AuditSeuil,
  CreerDossier,
  DemandeDerogation,
  Dossier,
  EtapeProcedure,
  FiltresDossiers,
  ModifierAffectation,
  ValiderDerogation,
  ValiderSensibilite,
} from "@/types/domaine";
import type { StatutCycleVie, StatutValidation, TypeEtape } from "@/types/enums";

/**
 * Dossiers (#1 à #8, plus `POST /dossiers/{id}/etapes`) — miroir 1:1 des endpoints, sans logique
 * métier.
 *
 * Les règles de cohérence (catégorie déduite de la nature, champs conditionnels, transitions de
 * cycle de vie) sont portées par le backend. L'interface les rejoue en amont pour éviter un
 * aller-retour, mais c'est le backend qui arbitre : ce service ne décide de rien.
 */
export const dossierService = {
  /**
   * #2 — liste paginée.
   *
   * `reference`, `clientId` et `mesDossiers` ont été ajoutés au backend en M16 (QF-07) : sans eux,
   * un juriste ne pouvait retrouver un dossier qu'en parcourant les pages. Filtrer côté navigateur
   * n'était pas une option — sur une liste paginée, la recherche n'aurait porté que sur la page
   * affichée et aurait donc menti.
   */
  lister: async (filtres: FiltresDossiers = {}): Promise<PageReponse<Dossier>> => {
    const { data } = await apiClient.get<PageReponse<Dossier>>("/dossiers", {
      params: {
        nature: filtres.nature || undefined,
        categorie: filtres.categorie || undefined,
        juridiction: filtres.juridiction || undefined,
        reference: filtres.reference || undefined,
        clientId: filtres.clientId ?? undefined,
        // `false` est le défaut du backend : ne pas l'envoyer garde l'URL lisible.
        mesDossiers: filtres.mesDossiers ? true : undefined,
        page: filtres.page ?? 0,
        size: filtres.size ?? 20,
      },
    });
    return data;
  },

  /** #3 — seule réponse qui porte l'historique. `documents` y est vide par construction (Q-67). */
  consulter: async (id: number): Promise<Dossier> => {
    const { data } = await apiClient.get<Dossier>(`/dossiers/${id}`);
    return data;
  },

  /**
   * #1 — création. Exige `ROLE_SAISIE`.
   *
   * `categorie` n'est délibérément pas transmise : le backend la déduit de `nature` (RG-DOS-02) et
   * refuse une valeur divergente. L'envoyer n'apporterait qu'un risque d'incohérence.
   */
  creer: async (dossier: CreerDossier): Promise<Dossier> => {
    const { data } = await apiClient.post<Dossier>("/dossiers", dossier);
    return data;
  },

  /**
   * #4 — **remplace** les affectations, n'en ajoute pas.
   *
   * Un juriste ou un avocat déjà affecté provoque un 409 `ERR-003` : ce n'est pas un échec mais
   * une demande de confirmation, que l'on rejoue avec `forcer`. Le backend alerte alors le DJ.
   */
  modifierAffectation: async (
    id: number,
    affectation: ModifierAffectation,
    forcer = false,
  ): Promise<Dossier> => {
    const { data } = await apiClient.put<Dossier>(`/dossiers/${id}/affectation`, affectation, {
      params: forcer ? { forcer: true } : {},
    });
    return data;
  },

  /** #5 — 400 `ERR-004` si la transition n'est pas permise (cf. `lib/transitions.ts`). */
  modifierStatutEtape: async (
    id: number,
    etapeId: number,
    nouveauStatut: StatutCycleVie,
  ): Promise<EtapeProcedure> => {
    const { data } = await apiClient.patch<EtapeProcedure>(
      `/dossiers/${id}/etapes/${etapeId}/statut`,
      { nouveauStatut },
    );
    return data;
  },

  /**
   * Endpoint non numéroté — positionnement direct à une étape. Crée au passage les étapes
   * intermédiaires manquantes, au statut `OUVERTURE`.
   */
  creerEtape: async (id: number, type: TypeEtape): Promise<EtapeProcedure> => {
    const { data } = await apiClient.post<EtapeProcedure>(`/dossiers/${id}/etapes`, { type });
    return data;
  },

  /** #6 — uniquement sur un dossier sensible **déjà validé**. Motif obligatoire. */
  demanderDerogation: async (id: number, demande: DemandeDerogation): Promise<AuditSeuil> => {
    const { data } = await apiClient.post<AuditSeuil>(`/dossiers/${id}/seuil-derogation`, demande);
    return data;
  },

  /**
   * Demandes de seuil d'un dossier, la plus récente d'abord — `statut: "EN_ATTENTE"` pour la file
   * d'arbitrage. Ajouté au backend le 2026-09-10 (Q-74) pour lever QF-23 : sans lui, l'identifiant
   * qu'exige l'arbitrage n'était exposé nulle part. Contient aussi la proposition initiale de
   * sensibilité.
   */
  listerDerogations: async (id: number, statut?: StatutValidation): Promise<AuditSeuil[]> => {
    const { data } = await apiClient.get<AuditSeuil[]>(`/dossiers/${id}/seuil-derogation`, {
      params: statut ? { statut } : {},
    });
    return data;
  },

  /**
   * #7 — arbitrage DJ/DJA. Recevable seulement sur un dossier dont la sensibilité est **validée** :
   * avant, le seul audit en attente est la proposition initiale, qui se tranche par #8 (Q-74).
   */
  validerDerogation: async (
    id: number,
    auditId: number,
    decision: ValiderDerogation,
  ): Promise<AuditSeuil> => {
    const { data } = await apiClient.put<AuditSeuil>(
      `/dossiers/${id}/seuil-derogation/${auditId}`,
      decision,
    );
    return data;
  },

  /** #8 — validation ou rejet de la sensibilité proposée à la création. */
  validerSensibilite: async (id: number, decision: ValiderSensibilite): Promise<Dossier> => {
    const { data } = await apiClient.post<Dossier>(`/dossiers/${id}/sensibilite/validation`, decision);
    return data;
  },
};
