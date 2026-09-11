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

/** Décisions devenues définitives (#51-#53, lecture Q-88) et base jurisprudentielle (#54, #55). */
export const decisionService = {
  /** 🆕 Q-88 — adjudications et condamnations du dossier (404 si le dossier est inconnu). */
  lister: async (dossierId: number): Promise<DecisionsDossier> => {
    const { data } = await apiClient.get<DecisionsDossier>(`/dossiers/${dossierId}/decisions`);
    return data;
  },

  /** #51 — juriste ; étape `CLOTURE` exigée, reliquat ≥ 0 (400 sinon). */
  creerAdjudication: async (dossierId: number, corps: CreerAdjudication): Promise<Adjudication> => {
    const { data } = await apiClient.post<Adjudication>(`/dossiers/${dossierId}/adjudications`, corps);
    return data;
  },

  /** #52 — juriste ; aucune précondition d'étape (Q-59). */
  creerCondamnation: async (dossierId: number, corps: CreerCondamnation): Promise<Condamnation> => {
    const { data } = await apiClient.post<Condamnation>(`/dossiers/${dossierId}/condamnations`, corps);
    return data;
  },

  /** #53 — le statut de paiement suit l'exécution (UC-DEF-02 étape 8). */
  modifierStatutCondamnation: async (id: number, statutPaiement: StatutPaiementCondamnation): Promise<Condamnation> => {
    const { data } = await apiClient.patch<Condamnation>(`/condamnations/${id}/statut`, { statutPaiement });
    return data;
  },

  /**
   * #55 — recherche paginée, la plus récente d'abord. Depuis Q-89 : partielle et insensible à la
   * casse, filtrable par dossier.
   */
  rechercherJurisprudences: async (filtres: FiltresJurisprudence): Promise<PageReponse<Jurisprudence>> => {
    const { data } = await apiClient.get<PageReponse<Jurisprudence>>("/jurisprudences", {
      params: {
        motCle: filtres.motCle || undefined,
        natureDecision: filtres.natureDecision || undefined,
        juridiction: filtres.juridiction || undefined,
        dossierId: filtres.dossierId ?? undefined,
        page: filtres.page ?? 0,
        size: filtres.size ?? 20,
      },
    });
    return data;
  },

  /**
   * #54 — multipart : le fichier et les champs d'indexation, un champ `motsCles` par mot-clé.
   * Comme pour la GED, le type multipart doit être déclaré : axios convertirait sinon le FormData
   * en JSON.
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

/** « saisie immobilière, hypothèque » → ["saisie immobilière", "hypothèque"], sans vides ni doublons. */
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
