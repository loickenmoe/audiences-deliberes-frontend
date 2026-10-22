import { TAILLE_PAGE } from "@/hooks/const";
import { apiClient, type PageReponse } from "@/lib/api/client";
import type {
  PartageAvocat,
  DemandeSuppression,
  DocumentDossier,
  RapportJournalier,
  ResultatSuppression,
  StatutSuppression,
} from "@/types/domaine";

/**
 * Document management - dossier documents (#38, #39, #40, #43), DJ/DJA deletion request queue
 * (#63, #41) and daily report (#42).
 */
export const gedService = {
  /**
   * #43 - documents of a dossier, the **only** reliable source (`DossierResponse.documents` is
   * always empty). Items carry no download URL: it is requested on opening (#39) and lasts 10 minutes.
   */
  listerDocumentsDossier: async (
    dossierId: number,
    page = 0,
    size = TAILLE_PAGE,
  ): Promise<PageReponse<DocumentDossier>> => {
    const { data } = await apiClient.get<PageReponse<DocumentDossier>>(`/dossiers/${dossierId}/documents`, {
      params: { page, size },
    });
    return data;
  },

  /**
   * #38 - uploads a document. Requires `ROLE_SAISIE` and an **existing** dossier: upload always
   * follows creation, never in the same request.
   */
  deposer: async (dossierId: number, typeDocument: string, fichier: File): Promise<DocumentDossier> => {
    const corps = new FormData();
    corps.append("file", fichier);
    const { data } = await apiClient.post<DocumentDossier>("/ged/documents", corps, {
      params: { dossierId, typeDocument },
      /*
       * The client defaults to `application/json`, with which axios 1.x **converts FormData to
       * JSON** and the file is never sent. Declaring multipart lets the browser set the boundary.
       */
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  /** #39 - the only response carrying `urlTelechargement`, pre-signed and valid for 10 minutes. */
  consulter: async (id: number): Promise<DocumentDossier> => {
    const { data } = await apiClient.get<DocumentDossier>(`/ged/documents/${id}`);
    return data;
  },

  /**
   * #40 - two behaviours, distinguished by **HTTP status**, not by body:
   * · 200 - DJ/DJA: immediate deletion, the deleted document is returned;
   * · 202 - author legal officer: a request is created, the document stays until decided.
   */
  supprimer: async (id: number): Promise<ResultatSuppression> => {
    const reponse = await apiClient.delete<DocumentDossier | DemandeSuppression>(`/ged/documents/${id}`);
    return reponse.status === 202
      ? { immediate: false, demande: reponse.data as DemandeSuppression }
      : { immediate: true, document: reponse.data as DocumentDossier };
  },

  /**
   * #63 - DJ/DJA queue. With `statut`, requests of that status, **oldest first** (processing
   * order); without, the full history, most recent first.
   */
  listerDemandesSuppression: async (
    statut: StatutSuppression | null,
    page = 0,
    size = TAILLE_PAGE,
  ): Promise<PageReponse<DemandeSuppression>> => {
    const { data } = await apiClient.get<PageReponse<DemandeSuppression>>("/ged/demandes-suppression", {
      params: { ...(statut ? { statut } : {}), page, size },
    });
    return data;
  },

  /**
   * #41 - DJ/DJA decision on a document's pending request. Approved: the document is deleted.
   * Rejected: it is kept, and the mandatory reason is sent to the legal officer.
   */
  deciderSuppression: async (
    documentId: number,
    decision: { decision: "APPROUVEE" } | { decision: "REJETEE"; motifRejet: string },
  ): Promise<DemandeSuppression> => {
    const { data } = await apiClient.put<DemandeSuppression>(
      `/ged/documents/${documentId}/approbation-suppression`,
      decision,
    );
    return data;
  },

  /**
   * Shares a document with the dossier's lawyer. On a sensitive dossier, a legal officer's action
   * becomes a **proposal** validated by the DJ or DJA; the server decides and the response says
   * which happened. 409 if already shared.
   */
  partagerAvecAvocat: async (documentId: number): Promise<PartageAvocat> => {
    const { data } = await apiClient.put<PartageAvocat>(`/ged/documents/${documentId}/partage-avocat`);
    return data;
  },

  /**
   * Whether a lawyer assigned to this dossier is constituted on it - the rule that opens documents
   * to them, so the sharer knows whether sharing will have any effect.
   */
  etatPartageDossier: async (dossierId: number): Promise<{ avocatConstitue: boolean }> => {
    const { data } = await apiClient.get<{ avocatConstitue: boolean }>(`/dossiers/${dossierId}/partage-avocat`);
    return data;
  },

  /** Removes the share, or cancels a proposal. */
  retirerPartageAvocat: async (documentId: number): Promise<PartageAvocat> => {
    const { data } = await apiClient.delete<PartageAvocat>(`/ged/documents/${documentId}/partage-avocat`);
    return data;
  },

  /** DJ, DJA: validates or rejects a proposal. A rejection requires a reason (400 otherwise). */
  arbitrerPartageAvocat: async (
    documentId: number,
    decision: { decision: "VALIDE" } | { decision: "REJETE"; motif: string },
  ): Promise<PartageAvocat> => {
    const { data } = await apiClient.put<PartageAvocat>(
      `/ged/documents/${documentId}/partage-avocat/arbitrage`,
      decision,
    );
    return data;
  },

  /** DJ, DJA: queue of proposed shares, oldest first. */
  partagesAvocat: async (page = 0, size = TAILLE_PAGE): Promise<PageReponse<PartageAvocat>> => {
    const { data } = await apiClient.get<PageReponse<PartageAvocat>>("/ged/partages-avocat", { params: { page, size } });
    return data;
  },

  /** #42 - document activity of one day; a day without activity returns zeros, not an error. */
  rapportJournalier: async (date: string): Promise<RapportJournalier> => {
    const { data } = await apiClient.get<RapportJournalier>("/ged/rapport-journalier", { params: { date } });
    return data;
  },

  /**
   * Content of a document from its pre-signed URL. Uses **bare** `fetch`, never `apiClient`: an
   * `Authorization` header would make MinIO check our Keycloak token instead of the signature and
   * refuse. MinIO allows the application origin through CORS.
   */
  recupererContenu: async (url: string): Promise<Blob> => {
    const reponse = await fetch(url);
    if (!reponse.ok) throw new Error(`Stockage : ${reponse.status}`);
    return reponse.blob();
  },
};
