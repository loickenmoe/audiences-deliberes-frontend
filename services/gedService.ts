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
 * GED — pièces d'un dossier (#38, #39, #40, #43), file des demandes de suppression du DJ/DJA (#63,
 * #41) et rapport journalier (#42).
 */
export const gedService = {
  /**
   * #43 — documents d'un dossier.
   *
   * C'est la **seule** source fiable : `DossierResponse.documents` est vide par construction
   * (Q-67 backend). Les éléments de cette liste ne portent **pas** d'URL de téléchargement : on la
   * demande au moment de l'ouverture (#39), et c'est tant mieux, elle ne vit que 10 minutes.
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
   * #38 — dépôt d'une pièce. Exige `ROLE_SAISIE` et un dossier **déjà créé** : le dépôt se fait
   * toujours après la création, jamais dans la même requête (le module dossier ne dépend pas de la
   * GED, Q-67).
   */
  deposer: async (dossierId: number, typeDocument: string, fichier: File): Promise<DocumentDossier> => {
    const corps = new FormData();
    corps.append("file", fichier);
    const { data } = await apiClient.post<DocumentDossier>("/ged/documents", corps, {
      params: { dossierId, typeDocument },
      /*
       * Le client déclare `application/json` par défaut. Avec ce type, axios 1.x **convertit un
       * FormData en JSON** : le fichier ne partirait jamais. Déclarer multipart laisse le
       * navigateur poser lui-même la frontière des parties.
       */
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  /** #39 — seule réponse qui porte `urlTelechargement`, pré-signée et valable 10 minutes. */
  consulter: async (id: number): Promise<DocumentDossier> => {
    const { data } = await apiClient.get<DocumentDossier>(`/ged/documents/${id}`);
    return data;
  },

  /**
   * #40 — deux comportements, distingués par le **statut HTTP** et non par le corps :
   * · 200 — DJ/DJA : suppression immédiate, le document supprimé est renvoyé ;
   * · 202 — juriste auteur : une demande est créée, le document reste en place jusqu'à décision.
   */
  supprimer: async (id: number): Promise<ResultatSuppression> => {
    const reponse = await apiClient.delete<DocumentDossier | DemandeSuppression>(`/ged/documents/${id}`);
    return reponse.status === 202
      ? { immediate: false, demande: reponse.data as DemandeSuppression }
      : { immediate: true, document: reponse.data as DocumentDossier };
  },

  /**
   * #63 — file du DJ/DJA. Avec `statut`, les demandes de ce statut, **la plus ancienne d'abord**
   * (l'ordre de traitement) ; sans, tout l'historique, la plus récente d'abord.
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
   * #41 — décision du DJ/DJA sur la demande en attente d'un document. Approuvée : le document est
   * supprimé. Rejetée : il est conservé, et le motif — obligatoire — est transmis au juriste.
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
   * QF-64 — partage une pièce avec l'avocat du dossier. Sur un dossier sensible, le geste d'un
   * juriste devient une **proposition** que le DJ ou la DJA valide : c'est le serveur qui le
   * décide, et la réponse dit lequel des deux a eu lieu. 409 si c'est déjà fait.
   */
  partagerAvecAvocat: async (documentId: number): Promise<PartageAvocat> => {
    const { data } = await apiClient.put<PartageAvocat>(`/ged/documents/${documentId}/partage-avocat`);
    return data;
  },

  /** QF-64 — retire le partage, ou annule une proposition. */
  retirerPartageAvocat: async (documentId: number): Promise<PartageAvocat> => {
    const { data } = await apiClient.delete<PartageAvocat>(`/ged/documents/${documentId}/partage-avocat`);
    return data;
  },

  /** QF-64 — DJ, DJA : valide ou rejette une proposition. Un rejet exige son motif (400 sinon). */
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

  /** QF-64 — DJ, DJA : la file des partages proposés, le plus ancien d'abord. */
  partagesAvocat: async (page = 0, size = TAILLE_PAGE): Promise<PageReponse<PartageAvocat>> => {
    const { data } = await apiClient.get<PageReponse<PartageAvocat>>("/ged/partages-avocat", { params: { page, size } });
    return data;
  },

  /** #42 — activité documentaire d'une journée ; un jour sans activité rend des zéros, pas une erreur. */
  rapportJournalier: async (date: string): Promise<RapportJournalier> => {
    const { data } = await apiClient.get<RapportJournalier>("/ged/rapport-journalier", { params: { date } });
    return data;
  },

  /**
   * Contenu d'un document, à partir de son URL pré-signée.
   *
   * Par `fetch` **nu**, surtout pas par `apiClient` : l'URL est déjà signée, et un en-tête
   * `Authorization` ferait vérifier à MinIO notre jeton Keycloak à la place de la signature — il
   * refuserait. MinIO autorise l'origine de l'application (CORS vérifié, QF-06).
   */
  recupererContenu: async (url: string): Promise<Blob> => {
    const reponse = await fetch(url);
    if (!reponse.ok) throw new Error(`Stockage : ${reponse.status}`);
    return reponse.blob();
  },
};
