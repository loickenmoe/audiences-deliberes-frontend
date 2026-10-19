import { apiClient, type PageReponse } from "@/lib/api/client";
import type {
  ActionDetaillee,
  DetailIndicateur,
  IndicateurTableauDeBord,
  Rapport,
  RapportActivite,
  RapportAvocats,
  RapportNominatif,
  TableauDeBord,
} from "@/types/domaine";
import type { CategorieDossier, FormatRapport, TypeRapport } from "@/types/enums";

/**
 * Whose activity sheet is requested. **Nothing means "me"**: the server knows the caller, so the
 * screen never sends its own identifier. A colleague is designated by account, a lawyer by directory
 * entry. The server rejects both together, since serving one would misrepresent what was read.
 */
export type CibleActivite = { utilisateurId: number } | { avocatId: number };

/** Report bounds. `type` is only a period label. */
export interface PeriodeRapport {
  type: TypeRapport;
  dateDebut: string;
  dateFin: string;
  /** Category scope. Absent = both. */
  categorie?: CategorieDossier;
}

/**
 * Reporting (#49, #50). The dashboard is reserved to the DJ (US 8.5), the report to the legal officer
 * (US 8.4); the DJ also holds `ROLE_JURISTE`, so it reaches both.
 */
export const reportingService = {
  /**
   * #50 - real-time indicators, optionally scoped by category (absent = both, the screen default).
   * Server invariant for all nine: **Recovery + Operating disputes = All categories**.
   */
  tableauDeBord: async (categorie?: CategorieDossier): Promise<TableauDeBord> => {
    const { data } = await apiClient.get<TableauDeBord>("/tableau-de-bord", {
      params: { categorie },
    });
    return data;
  },

  /**
   * #49 as JSON. **`null` when the backend answers 204** (no activity in the period): an empty
   * state, not an error, handled here so screens do not reinterpret the status.
   */
  genererRapport: async (periode: PeriodeRapport): Promise<Rapport | null> => {
    const reponse = await apiClient.get<Rapport | "">("/rapports", {
      params: { ...periode, format: "JSON" },
    });
    return reponse.status === 204 || !reponse.data ? null : (reponse.data as Rapport);
  },

  /**
   * Activity of each user over a period - DJ and DJA only. **`null` on 204**: a page of zeros would
   * suggest nobody did anything.
   */
  rapportNominatif: async (dateDebut: string, dateFin: string): Promise<RapportNominatif | null> => {
    const reponse = await apiClient.get<RapportNominatif | "">("/rapports/nominatif", {
      params: { dateDebut, dateFin },
    });
    return reponse.status === 204 || !reponse.data ? null : (reponse.data as RapportNominatif);
  },

  /**
   * Detail of a dashboard block - DJ and DJA. The list returns exactly what the block counts, so the
   * page total is the block total: never sum the rows of a page. Paginated because a block can be large.
   */
  detailTableauDeBord: async (
    indicateur: IndicateurTableauDeBord,
    page: number,
    categorie?: CategorieDossier,
  ): Promise<PageReponse<DetailIndicateur>> => {
    const { data } = await apiClient.get<PageReponse<DetailIndicateur>>("/tableau-de-bord/details", {
      // Same scope as the originating block, so the detail matches the number it explains.
      params: { indicateur, page, size: 20, categorie },
    });
    return data;
  },

  /**
   * Lawyers' activity over a period - DJ and DJA. Separate from the per-user report because lawyers
   * perform none of the internal production types it counts. **`null` on 204**.
   */
  rapportAvocats: async (dateDebut: string, dateFin: string): Promise<RapportAvocats | null> => {
    const reponse = await apiClient.get<RapportAvocats | "">("/rapports/nominatif/avocats", {
      params: { dateDebut, dateFin },
    });
    return reponse.status === 204 || !reponse.data ? null : (reponse.data as RapportAvocats);
  },

  /**
   * Activity sheet of one person - **everyone on themselves**, the DJ and DJA on anyone. No target
   * means "me"; a target is only served to management. **`null` on 204**: an empty state, not an error.
   */
  rapportActivite: async (
    dateDebut: string,
    dateFin: string,
    cible?: CibleActivite,
  ): Promise<RapportActivite | null> => {
    const reponse = await apiClient.get<RapportActivite | "">("/rapports/activite", {
      params: { dateDebut, dateFin, ...cible },
    });
    return reponse.status === 204 || !reponse.data ? null : (reponse.data as RapportActivite);
  },

  /**
   * The same sheet as a document, so each user can download their own reports. The file name comes
   * from `Content-Disposition`, which CORS does not expose, so the caller rebuilds it with
   * `nomFichierActivite`; a unit test keeps both in sync.
   */
  exporterActivite: async (
    dateDebut: string,
    dateFin: string,
    format: Exclude<FormatRapport, "JSON">,
    cible?: CibleActivite,
  ): Promise<Blob | null> => {
    const reponse = await apiClient.get<Blob>("/rapports/activite/export", {
      params: { dateDebut, dateFin, format, ...cible },
      responseType: "blob",
    });
    if (reponse.status === 204) return null;
    const data = reponse.data;
    if (!data) return null;
    return data instanceof Blob ? data : new Blob([data as BlobPart]);
  },

  /** Actions behind a count, paginated because a count can be large. */
  detailsActivite: async (
    code: string,
    dateDebut: string,
    dateFin: string,
    page: number,
    cible?: CibleActivite,
  ): Promise<PageReponse<ActionDetaillee>> => {
    const { data } = await apiClient.get<PageReponse<ActionDetaillee>>("/rapports/activite/details", {
      params: { code, dateDebut, dateFin, page, size: 20, ...cible },
    });
    return data;
  },

  /**
   * #49 as PDF, Excel or CSV. **`null` on 204**: no file for a period without activity. Errors also
   * arrive as binary; the HTTP client interceptor decodes them so the backend message reaches the user.
   */
  exporterRapport: async (
    periode: PeriodeRapport,
    format: Exclude<FormatRapport, "JSON">,
  ): Promise<Blob | null> => {
    const reponse = await apiClient.get<Blob>("/rapports", {
      params: { ...periode, format },
      responseType: "blob",
    });
    if (reponse.status === 204) return null;
    // Browsers return a `Blob`, Node returns a buffer: normalise so callers are environment-agnostic.
    const data = reponse.data;
    if (!data) return null;
    return data instanceof Blob ? data : new Blob([data as BlobPart]);
  },
};
