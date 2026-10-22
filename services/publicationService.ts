import { TAILLE_PAGE } from "@/hooks/const";
import { apiClient, type PageReponse } from "@/lib/api/client";
import { gedService } from "@/services/gedService";
import type {
  CommentairePublication,
  CorrespondanceAvocat,
  DeposerCompteRendu,
  Publication,
} from "@/types/domaine";
import type { StatutPublication, TypeAutrePublication } from "@/types/enums";

/** Validation, or a rejection that always carries a reason (RG-INT-10). */
export type DecisionPublication = { statut: "VALIDE" } | { statut: "REJETE"; motifRejet: string };

/** Publications: internal review (#30, #32, #33, #34, #59) and lawyer submissions (#29, #31). */
export const publicationService = {
  /**
   * #59: paginated list. `statut=DEPOSE` is in arrival order (the assistant's queue), otherwise
   * most recent first. Metadata only, so access restriction does not apply.
   */
  lister: async (filtres: {
    dossierId?: number;
    statut?: StatutPublication | null;
    page?: number;
    size?: number;
  }): Promise<PageReponse<Publication>> => {
    const { data } = await apiClient.get<PageReponse<Publication>>("/publications", {
      params: {
        dossierId: filtres.dossierId ?? undefined,
        statut: filtres.statut ?? undefined,
        page: filtres.page ?? 0,
        size: filtres.size ?? TAILLE_PAGE,
      },
    });
    return data;
  },

  /**
   * #32: detail with file URL, comments and correspondence. A non-validated publication is only
   * readable by the assistant (404 otherwise); an access restriction naming another legal officer
   * returns 403 `ERR-009`, shown as a "restricted access" screen rather than an error.
   */
  consulter: async (id: number): Promise<Publication> => {
    const { data } = await apiClient.get<Publication>(`/publications/${id}`);
    return data;
  },

  /** #30: assistant, publication in `DEPOSE` (409 otherwise). */
  valider: async (id: number, decision: DecisionPublication): Promise<Publication> => {
    const { data } = await apiClient.put<Publication>(`/publications/${id}/validation`, decision);
    return data;
  },

  /** #33: legal officer; the comment goes to the DJ and DJA, never to the lawyer (RG-INT-07). */
  commenter: async (id: number, contenu: string): Promise<CommentairePublication> => {
    const { data } = await apiClient.post<CommentairePublication>(`/publications/${id}/commentaires`, { contenu });
    return data;
  },

  /** #34: DJ/DJA; a single correspondence to the lawyer (409 if already sent). */
  transmettreCorrespondance: async (id: number, contenu: string): Promise<CorrespondanceAvocat> => {
    const { data } = await apiClient.post<CorrespondanceAvocat>(`/publications/${id}/correspondance`, { contenu });
    return data;
  },

  /**
   * #29: the lawyer submits a hearing report (US 5.1, screen 33), linked to a hearing of their case,
   * with an optional attachment. 404 if the hearing does not belong to the case. Always multipart,
   * with or without a file, to keep a single call path.
   */
  deposerCompteRendu: async (depot: DeposerCompteRendu, fichier?: File | null): Promise<Publication> => {
    const corps = new FormData();
    if (fichier) corps.append("file", fichier);
    const { data } = await apiClient.post<Publication>("/publications/cr-audience", corps, {
      params: {
        dossierId: depot.dossierId,
        audienceId: depot.audienceId,
        contenu: depot.contenu,
        ...(depot.restrictionAcces ? { restrictionAcces: depot.restrictionAcces } : {}),
      },
      // Without this header, axios serializes the FormData as JSON and the file part is lost.
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  /**
   * #31: the lawyer submits a document, decision or brief (US 5.3, screen 33). Metadata go in query
   * parameters and the file in the multipart body; the multipart type must be declared or axios
   * serializes the `FormData` as JSON.
   */
  deposerAutre: async (
    dossierId: number,
    typeDocument: TypeAutrePublication,
    fichier: File,
    restrictionAcces?: number,
  ): Promise<Publication> => {
    const corps = new FormData();
    corps.append("file", fichier);
    const { data } = await apiClient.post<Publication>("/publications/autres", corps, {
      params: { dossierId, typeDocument, ...(restrictionAcces ? { restrictionAcces } : {}) },
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  /** Fetches a fresh pre-signed URL (valid 10 minutes), then the file. */
  contenuFichier: async (id: number): Promise<Blob> => {
    const publication = await publicationService.consulter(id);
    if (!publication.urlTelechargement) throw new Error("URL de téléchargement absente");
    return gedService.recupererContenu(publication.urlTelechargement);
  },
};
