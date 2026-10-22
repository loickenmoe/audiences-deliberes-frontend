import { TAILLE_PAGE } from "@/hooks/const";
import { apiClient, type PageReponse } from "@/lib/api/client";
import type {
  AuditSeuil,
  CreerDossier,
  DemandeDerogation,
  Dossier,
  EtapeProcedure,
  FiltresDossiers,
  HistoriqueAction,
  ModifierAffectation,
  ValiderDerogation,
  ModifierDiligence,
  ProposerDiligence,
  ValiderSensibilite,
} from "@/types/domaine";
import type { StatutCycleVie, StatutValidation, TypeEtape } from "@/types/enums";

/**
 * Dossiers (#1 to #8, plus `POST /dossiers/{id}/etapes`) - 1:1 mirror of the endpoints. Consistency
 * rules are replayed in the UI to save a round trip, but the backend arbitrates.
 */
export const dossierService = {
  /**
   * #2 - paginated list. Filtering is server-side: on a paginated list, client-side search would
   * only cover the displayed page.
   */
  lister: async (filtres: FiltresDossiers = {}): Promise<PageReponse<Dossier>> => {
    const { data } = await apiClient.get<PageReponse<Dossier>>("/dossiers", {
      params: {
        nature: filtres.nature || undefined,
        categorie: filtres.categorie || undefined,
        juridiction: filtres.juridiction || undefined,
        reference: filtres.reference || undefined,
        clientId: filtres.clientId ?? undefined,
        // `false` is the backend default: omitting it keeps the URL readable.
        mesDossiers: filtres.mesDossiers ? true : undefined,
        // `estSensible=false` is a legitimate filter (non-sensitive dossiers), distinct from "unset".
        estSensible: filtres.estSensible ?? undefined,
        sensibiliteStatut: filtres.sensibiliteStatut || undefined,
        typeEtape: filtres.typeEtape || undefined,
        statutEtape: filtres.statutEtape || undefined,
        dateDebut: filtres.dateDebut || undefined,
        dateFin: filtres.dateFin || undefined,
        // `RECENT` is the server default: omitting it keeps the URL readable.
        tri: filtres.tri && filtres.tri !== "RECENT" ? filtres.tri : undefined,
        page: filtres.page ?? 0,
        size: filtres.size ?? TAILLE_PAGE,
      },
    });
    return data;
  },

  /**
   * Full dossier history, paginated. The detail (#3) only embeds the first page, since RG-DOS-06
   * records every action; later entries are available through this endpoint.
   */
  historique: async (
    dossierId: number,
    page = 0,
    size = TAILLE_PAGE,
  ): Promise<PageReponse<HistoriqueAction>> => {
    const { data } = await apiClient.get<PageReponse<HistoriqueAction>>(
      `/dossiers/${dossierId}/historique`,
      { params: { page, size } },
    );
    return data;
  },

  /** #3 - the only response carrying the history. `documents` is always empty here. */
  consulter: async (id: number): Promise<Dossier> => {
    const { data } = await apiClient.get<Dossier>(`/dossiers/${id}`);
    return data;
  },

  /**
   * #1 - creation, requires `ROLE_SAISIE`. `categorie` is deliberately not sent: the backend derives
   * it from `nature` (RG-DOS-02) and rejects a diverging value.
   */
  creer: async (dossier: CreerDossier): Promise<Dossier> => {
    const { data } = await apiClient.post<Dossier>("/dossiers", dossier);
    return data;
  },

  /**
   * #4 - **replaces** the assignments. An already assigned legal officer or lawyer yields a 409
   * `ERR-003`: a confirmation request, replayed with `forcer`; the backend then alerts the DJ.
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

  /** #5 - 400 `ERR-004` if the transition is not allowed (see `lib/transitions.ts`). */
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

  /** Jumps directly to a step, creating missing intermediate steps with status `OUVERTURE`. */
  creerEtape: async (id: number, type: TypeEtape): Promise<EtapeProcedure> => {
    const { data } = await apiClient.post<EtapeProcedure>(`/dossiers/${id}/etapes`, { type });
    return data;
  },

  /** #6 - only on a sensitive dossier that is **already validated**. Reason required. */
  demanderDerogation: async (id: number, demande: DemandeDerogation): Promise<AuditSeuil> => {
    const { data } = await apiClient.post<AuditSeuil>(`/dossiers/${id}/seuil-derogation`, demande);
    return data;
  },

  /**
   * Threshold requests of a dossier, most recent first - `statut: "EN_ATTENTE"` for the arbitration
   * queue. Exposes the identifier arbitration needs; also includes the initial sensitivity proposal.
   */
  listerDerogations: async (id: number, statut?: StatutValidation): Promise<AuditSeuil[]> => {
    const { data } = await apiClient.get<AuditSeuil[]>(`/dossiers/${id}/seuil-derogation`, {
      params: statut ? { statut } : {},
    });
    return data;
  },

  /**
   * #7 - DJ/DJA arbitration, only on a dossier whose sensitivity is **validated**: before that, the
   * only pending audit is the initial proposal, decided through #8.
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

  /** #8 - validates or rejects a proposed sensitivity, whether proposed at creation or later. */
  validerSensibilite: async (id: number, decision: ValiderSensibilite): Promise<Dossier> => {
    const { data } = await apiClient.post<Dossier>(`/dossiers/${id}/sensibilite/validation`, decision);
    return data;
  },

  /**
   * The legal officer proposes special diligence on an open dossier (`ROLE_SAISIE`). The dossier
   * becomes `EN_ATTENTE`; **nothing changes for fees until arbitration**.
   */
  proposerDiligence: async (id: number, demande: ProposerDiligence): Promise<Dossier> => {
    const { data } = await apiClient.post<Dossier>(`/dossiers/${id}/sensibilite/proposition`, demande);
    return data;
  },

  /**
   * The DJ or DJA sets or lifts diligence directly - `PUT`, since it sets the dossier state rather
   * than creating a request. Removal restores the global threshold.
   */
  modifierDiligence: async (id: number, modification: ModifierDiligence): Promise<Dossier> => {
    const { data } = await apiClient.put<Dossier>(`/dossiers/${id}/sensibilite`, modification);
    return data;
  },
};
