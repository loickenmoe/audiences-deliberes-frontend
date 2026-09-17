import { TAILLE_PAGE } from "@/hooks/const";
import { apiClient, type PageReponse } from "@/lib/api/client";
import type { ArchiveAudit, PageAudit } from "@/types/domaine";

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

  /**
   * Extraction vers un fichier scellé (backend Q-113).
   *
   * **La période est obligatoire ici**, alors qu'elle est facultative à la consultation : une
   * archive sans période ne dit pas ce qu'elle contient, et son empreinte ne prouverait que son
   * intégrité, jamais son exhaustivité.
   *
   * Le fichier revient en octets, accompagné de son empreinte dans l'en-tête `X-Empreinte-SHA256` :
   * le destinataire peut la comparer sans avoir à interroger l'application.
   */
  exporter: async (
    filtres: FiltresAudit & { dateDebut: string; dateFin: string },
    format: "PDF" | "EXCEL",
  ): Promise<{ fichier: Blob; nomFichier: string; empreinte: string }> => {
    const reponse = await apiClient.get<Blob>("/historique/export", {
      responseType: "blob",
      params: {
        perimetre: filtres.perimetre ?? "TOUT",
        ...(filtres.dossierId ? { dossierId: filtres.dossierId } : {}),
        ...(filtres.utilisateurId ? { utilisateurId: filtres.utilisateurId } : {}),
        ...(filtres.code ? { code: filtres.code } : {}),
        dateDebut: filtres.dateDebut,
        dateFin: filtres.dateFin,
        format,
      },
    });
    const extension = format === "PDF" ? "pdf" : "xlsx";
    return {
      fichier: reponse.data,
      nomFichier: `audit-${filtres.dateDebut}-${filtres.dateFin}.${extension}`,
      empreinte: String(reponse.headers["x-empreinte-sha256"] ?? ""),
    };
  },

  /** Les archives déjà produites, de la plus récente à la plus ancienne, avec leur empreinte. */
  archives: async (page = 0, size = TAILLE_PAGE): Promise<PageReponse<ArchiveAudit>> => {
    const { data } = await apiClient.get<PageReponse<ArchiveAudit>>("/historique/exports", {
      params: { page, size },
    });
    return data;
  },

  /**
   * URL de récupération d'une archive. **Chaque appel est tracé côté serveur** : puiser dans les
   * archives ne doit pas être plus discret que consulter l'écran.
   */
  urlArchive: async (id: number): Promise<string> => {
    const { data } = await apiClient.get<{ url: string }>(`/historique/exports/${id}/telechargement`);
    return data.url;
  },
};
