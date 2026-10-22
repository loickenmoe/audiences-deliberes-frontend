import { TAILLE_PAGE } from "@/hooks/const";
import { apiClient, type PageReponse } from "@/lib/api/client";
import type { ArchiveAudit, PageAudit, VerificationArchive } from "@/types/domaine";

/** Scope of a query (mutually exclusive); `UN_DOSSIER` requires `dossierId`. */
export type PerimetreAudit = "TOUT" | "HORS_DOSSIER" | "UN_DOSSIER";

/** Audit filters, all optional; the scope defaults to `TOUT`. */
export interface FiltresAudit {
  perimetre?: PerimetreAudit;
  dossierId?: number;
  /** Action author filter, allowed by NF-CONF-01. */
  utilisateurId?: number;
  /** Typed action code, never a label: free text cannot be filtered reliably. */
  code?: string;
  dateDebut?: string;
  dateFin?: string;
}

/**
 * Audit of logged actions (DJ and DJA), queryable across cases (e.g. "what did X do last month?").
 * Every consultation is itself logged server-side with its criteria.
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
   * Export to a sealed file. The period is mandatory here so the archive states what it covers.
   * The file comes back with its fingerprint in the `X-Empreinte-SHA256` header, so the recipient
   * can verify it without querying the application.
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
    // Use the server-provided name, which carries the archive reference under which it is recorded.
    const extension = format === "PDF" ? "pdf" : "xlsx";
    const disposition = String(reponse.headers["content-disposition"] ?? "");
    const annonce = /filename="([^"]+)"/.exec(disposition)?.[1];

    return {
      fichier: reponse.data,
      nomFichier: annonce ?? `audit-${filtres.dateDebut}-${filtres.dateFin}.${extension}`,
      empreinte: String(reponse.headers["x-empreinte-sha256"] ?? ""),
    };
  },

  /** Archives already produced, most recent first, with their fingerprint. */
  archives: async (page = 0, size = TAILLE_PAGE): Promise<PageReponse<ArchiveAudit>> => {
    const { data } = await apiClient.get<PageReponse<ArchiveAudit>>("/historique/exports", {
      params: { page, size },
    });
    return data;
  },

  /**
   * Checks that a file matches a known archive. Only the browser-computed fingerprint is sent,
   * never the file.
   */
  verifier: async (empreinte: string): Promise<VerificationArchive> => {
    const { data } = await apiClient.get<VerificationArchive>("/historique/exports/verification", {
      params: { empreinte },
    });
    return data;
  },

  /**
   * Download URL of an archive. Each call is logged server-side, like any audit consultation.
   */
  urlArchive: async (id: number): Promise<string> => {
    const { data } = await apiClient.get<{ url: string }>(`/historique/exports/${id}/telechargement`);
    return data.url;
  },
};
