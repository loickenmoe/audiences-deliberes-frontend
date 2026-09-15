import { TAILLE_PAGE } from "@/hooks/const";
import { apiClient, type PageReponse } from "@/lib/api/client";
import type { DemandeConstitution, Publication } from "@/types/domaine";
import type { StatutAudience } from "@/types/enums";

/** Un dossier tel que l'avocat le voit : son identification, rien de plus (backend Q-96). */
export interface DossierAvocat {
  id: number;
  reference: string;
  nature: string;
  juridictionSaisie: string;
}

/** Une audience d'un de ses dossiers, de quoi la désigner dans un compte rendu (US 5.1). */
export interface AudienceAvocat {
  id: number;
  datePlanifiee: string;
  dateTenue: string | null;
  statut: StatutAudience;
}

/**
 * Une pièce justificative stockée (backend Q-97). `cle` est le **chemin de stockage**, à reporter
 * tel quel dans `piecesJustificatives` — c'est ce que le dictionnaire des données prévoit pour
 * `pieces_justificatives TEXT[]` : « chemins ou références des pièces ».
 */
export interface PieceJustificative {
  cle: string;
  nomFichier: string;
  urlTelechargement: string;
}

/**
 * Portail Avocat — les quatre lectures cadrées sur le prestataire connecté (backend Q-96, QF-01).
 *
 * L'avocat ne porte que `ROLE_AVOCAT` : il n'atteint ni `GET /dossiers` ni `GET /publications`,
 * réservés à `ROLE_CONSULTATION`. Ces endpoints lui sont propres et restreints **dans la requête**
 * du backend, pas par un filtre appliqué après coup.
 */
export const portailAvocatService = {
  /**
   * Les dossiers auxquels il est affecté. `size` est généreux par défaut : la liste alimente un
   * sélecteur, et paginer un sélecteur le rendrait inutilisable.
   */
  mesDossiers: async (page = 0, size = 100): Promise<PageReponse<DossierAvocat>> => {
    const { data } = await apiClient.get<PageReponse<DossierAvocat>>("/avocat/mes-dossiers", {
      params: { page, size },
    });
    return data;
  },

  /** Les audiences d'un de **ses** dossiers ; un autre dossier répond 403. */
  audiencesDeMonDossier: async (dossierId: number): Promise<AudienceAvocat[]> => {
    const { data } = await apiClient.get<AudienceAvocat[]>(
      `/avocat/mes-dossiers/${dossierId}/audiences`,
    );
    return data;
  },

  /** Ses propres dépôts, quel qu'en soit le statut — c'est là qu'il lit le motif d'un rejet. */
  mesPublications: async (page = 0, size = TAILLE_PAGE): Promise<PageReponse<Publication>> => {
    const { data } = await apiClient.get<PageReponse<Publication>>("/avocat/mes-publications", {
      params: { page, size },
    });
    return data;
  },

  /**
   * Dépose une pièce justificative et renvoie sa clé de stockage (UC-INT-01 étape 4, « l'avocat
   * **charge** les pièces justificatives »).
   *
   * Deux temps plutôt qu'un envoi unique : le contrat de `POST /frais/demandes` reste du JSON, et
   * un envoi qui échoue ne fait pas reperdre les pièces déjà transmises. Mêmes contrôles de format
   * et de poids que la GED — le backend les refuse en 400 `ERR-008`.
   */
  deposerPieceJustificative: async (fichier: File): Promise<PieceJustificative> => {
    const corps = new FormData();
    corps.append("file", fichier);
    const { data } = await apiClient.post<PieceJustificative>("/avocat/pieces-justificatives", corps, {
      // Sans ce type déclaré, axios sérialise le FormData en JSON et le fichier ne part jamais.
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  /** Les lettres de constitution qui le désignent. Liste courte, non paginée côté backend. */
  mesConstitutions: async (): Promise<DemandeConstitution[]> => {
    const { data } = await apiClient.get<DemandeConstitution[]>("/avocat/mes-constitutions");
    return data;
  },
};
