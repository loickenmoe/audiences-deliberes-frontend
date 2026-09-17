import { TAILLE_PAGE } from "@/hooks/const";
import { apiClient } from "@/lib/api/client";
import type { PageAudit } from "@/types/domaine";

/** Portée d'une consultation. Exclusives : `UN_DOSSIER` exige `dossierId`. */
export type PerimetreAudit = "TOUT" | "HORS_DOSSIER" | "UN_DOSSIER";

/** Filtres de l'audit. Tous facultatifs hormis la portée, qui vaut `TOUT` par défaut. */
export interface FiltresAudit {
  perimetre?: PerimetreAudit;
  dossierId?: number;
  /** Auteur recherché — autorisé par NF-CONF-01 ; c'est lui qui rend l'écran utile, et traçable. */
  utilisateurId?: number;
  /** Code typé (backend Q-111), jamais un libellé : un texte libre ne se filtre pas sans mentir. */
  code?: string;
  dateDebut?: string;
  dateFin?: string;
}

/**
 * Audit des actions historisées (backend Q-112) — DJ et DJA.
 *
 * **Ce qu'il apporte par rapport au journal qu'il remplace.** Celui-ci répondait à une question de
 * *couverture* : des lignes existaient sans point de lecture. Restait une question de *point
 * d'entrée* — « qu'a fait X le mois dernier ? », « toutes les suppressions du trimestre ? ». Aucune
 * ne part d'un dossier, aucune n'était donc possible.
 *
 * ⚠ **Toute consultation est historisée** côté serveur, avec ses critères. Ce n'est pas une
 * contrainte imposée à qui consulte : c'est ce qui lui permet de démontrer qu'il n'a regardé que ce
 * qu'il devait.
 */
export const auditService = {
  consulter: async (filtres: FiltresAudit = {}, page = 0, size = TAILLE_PAGE): Promise<PageAudit> => {
    const { data } = await apiClient.get<PageAudit>("/historique", {
      params: {
        perimetre: filtres.perimetre ?? "TOUT",
        ...(filtres.dossierId ? { dossierId: filtres.dossierId } : {}),
        ...(filtres.utilisateurId ? { utilisateurId: filtres.utilisateurId } : {}),
        ...(filtres.code ? { code: filtres.code } : {}),
        ...(filtres.dateDebut ? { dateDebut: filtres.dateDebut } : {}),
        ...(filtres.dateFin ? { dateFin: filtres.dateFin } : {}),
        page,
        size,
      },
    });
    return data;
  },
};
