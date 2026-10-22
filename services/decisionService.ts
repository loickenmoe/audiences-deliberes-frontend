import { TAILLE_PAGE } from "@/hooks/const";
import { apiClient, type PageReponse } from "@/lib/api/client";
import type {
  Adjudication,
  ArchiverJurisprudence,
  Condamnation,
  CreerAdjudication,
  CreerCondamnation,
  DecisionsDossier,
  Jurisprudence,
} from "@/types/domaine";
import type { StatutPaiementCondamnation } from "@/types/enums";

export interface FiltresJurisprudence {
  motCle?: string;
  natureDecision?: string;
  juridiction?: string;
  dossierId?: number;
  page?: number;
  size?: number;
}

/** Final decisions (#51-#53) and case-law base (#54, #55). */
export const decisionService = {
  /** Adjudications and convictions of the case (404 if the case is unknown). */
  lister: async (dossierId: number): Promise<DecisionsDossier> => {
    const { data } = await apiClient.get<DecisionsDossier>(`/dossiers/${dossierId}/decisions`);
    return data;
  },

  /** #51: legal officer; requires step `CLOTURE` and a remainder >= 0 (400 otherwise). */
  creerAdjudication: async (dossierId: number, corps: CreerAdjudication): Promise<Adjudication> => {
    const { data } = await apiClient.post<Adjudication>(`/dossiers/${dossierId}/adjudications`, corps);
    return data;
  },

  /** #52: legal officer; no step precondition. */
  creerCondamnation: async (dossierId: number, corps: CreerCondamnation): Promise<Condamnation> => {
    const { data } = await apiClient.post<Condamnation>(`/dossiers/${dossierId}/condamnations`, corps);
    return data;
  },

  /** #53: the payment status tracks enforcement (UC-DEF-02 step 8). */
  modifierStatutCondamnation: async (id: number, statutPaiement: StatutPaiementCondamnation): Promise<Condamnation> => {
    const { data } = await apiClient.patch<Condamnation>(`/condamnations/${id}/statut`, { statutPaiement });
    return data;
  },

  /**
   * #55: paginated search, most recent first; partial, case-insensitive matching, filterable by
   * case.
   */
  rechercherJurisprudences: async (filtres: FiltresJurisprudence): Promise<PageReponse<Jurisprudence>> => {
    const { data } = await apiClient.get<PageReponse<Jurisprudence>>("/jurisprudences", {
      params: {
        motCle: filtres.motCle || undefined,
        natureDecision: filtres.natureDecision || undefined,
        juridiction: filtres.juridiction || undefined,
        dossierId: filtres.dossierId ?? undefined,
        page: filtres.page ?? 0,
        size: filtres.size ?? TAILLE_PAGE,
      },
    });
    return data;
  },

  /**
   * #54: multipart with the file and indexing fields, one `motsCles` field per keyword. The
   * multipart content type must be declared, otherwise axios serializes the FormData as JSON.
   */
  archiverJurisprudence: async (indexation: ArchiverJurisprudence, fichier: File): Promise<Jurisprudence> => {
    const corps = new FormData();
    corps.append("file", fichier);
    if (indexation.dossierId !== undefined) corps.append("dossierId", String(indexation.dossierId));
    corps.append("typeArchive", indexation.typeArchive);
    for (const motCle of indexation.motsCles) corps.append("motsCles", motCle);
    corps.append("natureDecision", indexation.natureDecision);
    corps.append("juridiction", indexation.juridiction);
    corps.append("dateDecision", indexation.dateDecision);
    const { data } = await apiClient.post<Jurisprudence>("/jurisprudences", corps, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
};

/** Splits a comma-separated keyword input, dropping blanks and case-insensitive duplicates. */
export function decouperMotsCles(saisie: string): string[] {
  const vus = new Set<string>();
  const resultat: string[] = [];
  for (const brut of saisie.split(",")) {
    const motCle = brut.trim();
    const cle = motCle.toLowerCase();
    if (motCle && !vus.has(cle)) {
      vus.add(cle);
      resultat.push(motCle);
    }
  }
  return resultat;
}
