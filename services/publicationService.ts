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

/** Validation, ou rejet toujours motivé (RG-INT-10). */
export type DecisionPublication = { statut: "VALIDE" } | { statut: "REJETE"; motifRejet: string };

/**
 * Publications : l'instruction côté interne (#30, #32, #33, #34, #59) et les **dépôts de l'avocat**
 * (#29, #31), livrés avec le portail en F16.
 */
export const publicationService = {
  /**
   * #59 — liste paginée : `statut=DEPOSE` en ordre d'arrivée (la file de l'Assistante), sinon la
   * plus récente d'abord (Q-86). Métadonnées seulement : la restriction d'accès ne s'y applique pas.
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
   * #32 — détail, avec l'URL du fichier, les commentaires et la correspondance (Q-86). Une
   * publication non validée n'est lisible que par l'Assistante (404 sinon) ; une restriction d'accès
   * désignant un autre juriste rend **403 `ERR-009`** — un écran « accès restreint », pas une erreur.
   */
  consulter: async (id: number): Promise<Publication> => {
    const { data } = await apiClient.get<Publication>(`/publications/${id}`);
    return data;
  },

  /** #30 — Assistante, publication `DEPOSE` (409 sinon). */
  valider: async (id: number, decision: DecisionPublication): Promise<Publication> => {
    const { data } = await apiClient.put<Publication>(`/publications/${id}/validation`, decision);
    return data;
  },

  /** #33 — juriste : le commentaire va au DJ et à la DJA, jamais à l'avocat (RG-INT-07). */
  commenter: async (id: number, contenu: string): Promise<CommentairePublication> => {
    const { data } = await apiClient.post<CommentairePublication>(`/publications/${id}/commentaires`, { contenu });
    return data;
  },

  /** #34 — DJ/DJA : correspondance **unique** à l'avocat (409 si déjà transmise). */
  transmettreCorrespondance: async (id: number, contenu: string): Promise<CorrespondanceAvocat> => {
    const { data } = await apiClient.post<CorrespondanceAvocat>(`/publications/${id}/correspondance`, { contenu });
    return data;
  },

  /**
   * #29 — **l'avocat dépose son compte rendu** (US 5.1, écran 33) : un récit rattaché à une audience
   * de son dossier, accompagné d'une **pièce facultative** depuis Q-98 — le plumitif du greffe, une
   * note d'audience. Le backend répond 404 si l'audience n'appartient pas au dossier.
   *
   * Multipart dans les deux cas : le texte est obligatoire, le fichier ne l'est pas. Envoyer
   * systématiquement la même forme évite deux chemins d'appel pour un seul geste métier.
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
      // Sans ce type déclaré, axios sérialise le FormData en JSON et la partie disparaît.
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  /**
   * #31 — **l'avocat dépose une pièce, une décision ou une conclusion** (US 5.3, écran 33).
   * Multipart : les métadonnées en paramètres de requête, le seul fichier en partie — et le type
   * multipart doit être déclaré, sinon axios convertit le `FormData` en JSON et le fichier ne part
   * jamais.
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

  /** Fichier d'une autre publication : URL pré-signée fraîche (elle ne vit que 10 minutes), puis le fichier. */
  contenuFichier: async (id: number): Promise<Blob> => {
    const publication = await publicationService.consulter(id);
    if (!publication.urlTelechargement) throw new Error("URL de téléchargement absente");
    return gedService.recupererContenu(publication.urlTelechargement);
  },
};
