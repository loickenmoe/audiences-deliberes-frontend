import { TAILLE_PAGE } from "@/hooks/const";
import { apiClient, type PageReponse } from "@/lib/api/client";
import { gedService } from "@/services/gedService";
import type { DemandeConstitution, Publication } from "@/types/domaine";
import type { StatutAudience } from "@/types/enums";

/** A case as the lawyer sees it: identification only. */
export interface DossierAvocat {
  id: number;
  reference: string;
  nature: string;
  juridictionSaisie: string;
}

/** A hearing of one of the lawyer's cases, enough to reference it in a report (US 5.1). */
export interface AudienceAvocat {
  id: number;
  datePlanifiee: string;
  dateTenue: string | null;
  /** Where the hearing takes place. */
  juridiction: string | null;
  statut: StatutAudience;
  /** Note from the legal officer; null until the lawyer is retained. */
  noteAvocat: string | null;
}

/** A case document shared with the lawyer by the bank. */
export interface PieceAvocat {
  id: number;
  nomFichier: string;
  typeDocument: string | null;
  format: string;
  poids: number;
  partageLe: string | null;
}

/**
 * Shared documents of a case. `constitue` is separate because "no documents" and "not yet
 * retained" are resolved differently.
 */
export interface PiecesDossierAvocat {
  constitue: boolean;
  pieces: PieceAvocat[];
}

/**
 * A stored supporting document. `cle` is the storage path, to be copied as is into
 * `piecesJustificatives` (data dictionary: `pieces_justificatives TEXT[]`).
 */
export interface PieceJustificative {
  cle: string;
  nomFichier: string;
  urlTelechargement: string;
}

/**
 * Lawyer portal: reads scoped to the logged-in provider. The lawyer only has `ROLE_AVOCAT` and
 * cannot reach `GET /dossiers` or `GET /publications`; these endpoints are restricted in the
 * backend query itself, not by post-filtering.
 */
export const portailAvocatService = {
  /**
   * Cases the lawyer is assigned to, optionally searched by reference (server-side, so older cases
   * are found too). Large default `size` because the list feeds a picker.
   */
  mesDossiers: async (reference?: string, page = 0, size = 100): Promise<PageReponse<DossierAvocat>> => {
    const { data } = await apiClient.get<PageReponse<DossierAvocat>>("/avocat/mes-dossiers", {
      params: { ...(reference ? { reference } : {}), page, size },
    });
    return data;
  },

  /** Hearings of one of the lawyer's own cases; any other case returns 403. */
  audiencesDeMonDossier: async (dossierId: number): Promise<AudienceAvocat[]> => {
    const { data } = await apiClient.get<AudienceAvocat[]>(
      `/avocat/mes-dossiers/${dossierId}/audiences`,
    );
    return data;
  },

  /** Shared documents of the lawyer's case, if assigned and retained. */
  piecesDeMonDossier: async (dossierId: number): Promise<PiecesDossierAvocat> => {
    const { data } = await apiClient.get<PiecesDossierAvocat>(`/avocat/mes-dossiers/${dossierId}/pieces`);
    return data;
  },

  /**
   * Content of a shared document. The pre-signed URL is requested on each opening: it is valid ten
   * minutes, and this request is what the server logs as a read.
   */
  contenuPiece: async (dossierId: number, documentId: number): Promise<Blob> => {
    const { data } = await apiClient.get<{ urlTelechargement: string }>(
      `/avocat/mes-dossiers/${dossierId}/pieces/${documentId}`,
    );
    return gedService.recupererContenu(data.urlTelechargement);
  },

  /** The lawyer's own submissions, any status; this is where rejection reasons are read. */
  mesPublications: async (page = 0, size = TAILLE_PAGE): Promise<PageReponse<Publication>> => {
    const { data } = await apiClient.get<PageReponse<Publication>>("/avocat/mes-publications", {
      params: { page, size },
    });
    return data;
  },

  /**
   * Uploads a supporting document and returns its storage key (UC-INT-01 step 4). Done separately
   * so `POST /frais/demandes` stays JSON and a failed submission does not lose uploaded files.
   * Same format and size checks as the document store (400 `ERR-008`).
   */
  deposerPieceJustificative: async (fichier: File): Promise<PieceJustificative> => {
    const corps = new FormData();
    corps.append("file", fichier);
    const { data } = await apiClient.post<PieceJustificative>("/avocat/pieces-justificatives", corps, {
      // Without this header, axios serializes the FormData as JSON and the file is never sent.
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  /** Constitution letters naming the lawyer. Short list, not paginated by the backend. */
  mesConstitutions: async (): Promise<DemandeConstitution[]> => {
    const { data } = await apiClient.get<DemandeConstitution[]>("/avocat/mes-constitutions");
    return data;
  },
};
