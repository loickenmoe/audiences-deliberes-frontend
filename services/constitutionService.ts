import { TAILLE_PAGE } from "@/hooks/const";
import { apiClient, type PageReponse } from "@/lib/api/client";
import type { AvocatRepertoire, DemandeConstitution, LettreConstitution } from "@/types/domaine";
import type { StatutConstitution } from "@/types/enums";

/** Signature, ou rejet toujours motivé (RG-INT-08). */
export type DecisionConstitution = { decision: "VALIDEE" } | { decision: "REJETEE"; motifRejet: string };

/**
 * Ce qu'un rédacteur enregistre : la lettre, moins ce que le serveur décide seul — son identifiant,
 * son numéro proposé, son gel.
 */
export type RedactionLettre = Omit<
  LettreConstitution,
  "id" | "demandeId" | "numeroPropose" | "modifiable" | "dateGeneration" | "dateModification"
>;

/** Constitutions de prestataires (#35, #36, #60) et répertoire des avocats (#37). */
export const constitutionService = {
  /** #60 — `EN_ATTENTE` en ordre d'arrivée (la file du SH) ; sans filtre, l'historique, le plus récent d'abord. */
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

  /** #35 — juriste : motif obligatoire ; les SH sont notifiés. */
  solliciter: async (demande: { dossierId: number; prestataireId: number; motif: string }): Promise<DemandeConstitution> => {
    const { data } = await apiClient.post<DemandeConstitution>("/constitutions/prestataires", demande);
    return data;
  },

  /**
   * #36 — SH : la signature génère la lettre de constitution et la dépose dans la GED du dossier ;
   * un rejet motivé revient au juriste. 409 si la demande est déjà traitée.
   */
  decider: async (id: number, decision: DecisionConstitution): Promise<DemandeConstitution> => {
    const { data } = await apiClient.put<DemandeConstitution>(`/constitutions/prestataires/${id}/validation`, decision);
    return data;
  },

  /**
   * La lettre d'une demande — brouillon ou pièce signée (backend Q-115 B2).
   *
   * Lisible par le **juriste** qui l'a rédigée comme par le **SH** qui doit la signer : refuser cette
   * lecture au second reviendrait à lui demander de signer sans voir.
   */
  lettre: async (demandeId: number): Promise<LettreConstitution> => {
    const { data } = await apiClient.get<LettreConstitution>(`/constitutions/prestataires/${demandeId}/lettre`);
    return data;
  },

  /**
   * Enregistre la rédaction — **juriste seul**. Le SH consulte, accepte ou rejette ; il ne récrit
   * pas, ce qui préserve le sens de la seconde signature.
   *
   * **409** si la lettre est déjà signée : une pièce versée au dossier ne se retouche pas, une
   * correction passe par une nouvelle demande. **409** également si le numéro est déjà employé.
   */
  redigerLettre: async (demandeId: number, lettre: RedactionLettre): Promise<LettreConstitution> => {
    const { data } = await apiClient.put<LettreConstitution>(
      `/constitutions/prestataires/${demandeId}/lettre`,
      lettre,
    );
    return data;
  },

  /**
   * La lettre signée, mise en page **pour le papier préimprimé** de la banque : sans logo, sans
   * colonne ni mentions légales, que la feuille porte déjà.
   *
   * Désignée par le **document de la GED**, parce que c'est depuis l'onglet « Documents » d'un
   * dossier que le métier la reprend pour l'imprimer. Le PDF est régénéré à la demande : la pièce
   * archivée, elle, ne change pas.
   *
   * **404** si le document n'est pas une lettre de constitution.
   */
  lettrePourPapierPreimprime: async (documentId: number): Promise<Blob> => {
    const { data } = await apiClient.get<Blob>(`/constitutions/lettres/par-document/${documentId}`, {
      responseType: "blob",
    });
    return data;
  },

  /** #37 — répertoire, trié par charge croissante ; recherche par nom côté serveur. */
  repertoire: async (nom?: string, page = 0, size = TAILLE_PAGE): Promise<PageReponse<AvocatRepertoire>> => {
    const { data } = await apiClient.get<PageReponse<AvocatRepertoire>>("/repertoire/avocats", {
      params: { ...(nom ? { nom } : {}), page, size },
    });
    return data;
  },
};
