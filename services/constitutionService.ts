import { TAILLE_PAGE } from "@/hooks/const";
import { apiClient, type PageReponse } from "@/lib/api/client";
import type { AvocatRepertoire, DemandeConstitution, LettreConstitution } from "@/types/domaine";
import type { StatutConstitution } from "@/types/enums";

/** Signature, or a rejection that always carries a reason (RG-INT-08). */
export type DecisionConstitution = { decision: "VALIDEE" } | { decision: "REJETEE"; motifRejet: string };

/**
 * What a drafter saves: the letter minus server-owned fields (id, proposed number, lock state and
 * author). The author comes from the session, never from the payload, to preserve traceability.
 */
export type RedactionLettre = Omit<
  LettreConstitution,
  | "id"
  | "demandeId"
  | "numeroPropose"
  | "modifiable"
  | "dateGeneration"
  | "dateModification"
  | "redigeParNom"
  | "redigeParProfil"
>;

/** Provider constitutions (#35, #36, #60) and lawyer directory (#37). */
export const constitutionService = {
  /** #60: `EN_ATTENTE` in arrival order (the SH queue); unfiltered, full history, most recent first. */
  lister: async (
    statut: StatutConstitution | null,
    page = 0,
    size = TAILLE_PAGE,
  ): Promise<PageReponse<DemandeConstitution>> => {
    const { data } = await apiClient.get<PageReponse<DemandeConstitution>>("/constitutions/prestataires", {
      params: { ...(statut ? { statut } : {}), page, size },
    });
    return data;
  },

  /** #35: legal officer; reason required; SH users are notified. */
  solliciter: async (demande: { dossierId: number; prestataireId: number; motif: string }): Promise<DemandeConstitution> => {
    const { data } = await apiClient.post<DemandeConstitution>("/constitutions/prestataires", demande);
    return data;
  },

  /**
   * #36: SH. Signing generates the constitution letter and files it in the case's document store;
   * a reasoned rejection returns to the legal officer. 409 if already processed.
   */
  decider: async (id: number, decision: DecisionConstitution): Promise<DemandeConstitution> => {
    const { data } = await apiClient.put<DemandeConstitution>(`/constitutions/prestataires/${id}/validation`, decision);
    return data;
  },

  /**
   * The letter of a request (draft or signed). Readable by the drafting legal officer and by the
   * SH who must sign it.
   */
  lettre: async (demandeId: number): Promise<LettreConstitution> => {
    const { data } = await apiClient.get<LettreConstitution>(`/constitutions/prestataires/${demandeId}/lettre`);
    return data;
  },

  /**
   * Saves the draft (legal officer only; the SH reviews but never rewrites). 409 if the letter is
   * already signed (a correction requires a new request) or if the number is already used.
   */
  redigerLettre: async (demandeId: number, lettre: RedactionLettre): Promise<LettreConstitution> => {
    const { data } = await apiClient.put<LettreConstitution>(
      `/constitutions/prestataires/${demandeId}/lettre`,
      lettre,
    );
    return data;
  },

  /**
   * The signed letter laid out for the bank's pre-printed paper (no logo, column or legal notices).
   * Addressed by document-store id, since it is printed from the case's Documents tab. The PDF is
   * regenerated on demand; the archived document is unchanged. 404 if not a constitution letter.
   */
  lettrePourPapierPreimprime: async (documentId: number): Promise<Blob> => {
    const { data } = await apiClient.get<Blob>(`/constitutions/lettres/par-document/${documentId}`, {
      responseType: "blob",
    });
    return data;
  },

  /** #37: directory sorted by increasing workload; name search is server-side. */
  repertoire: async (nom?: string, page = 0, size = TAILLE_PAGE): Promise<PageReponse<AvocatRepertoire>> => {
    const { data } = await apiClient.get<PageReponse<AvocatRepertoire>>("/repertoire/avocats", {
      params: { ...(nom ? { nom } : {}), page, size },
    });
    return data;
  },
};
