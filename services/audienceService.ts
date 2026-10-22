import { TAILLE_PAGE } from "@/hooks/const";
import { apiClient, type PageReponse } from "@/lib/api/client";
import type {
  Alarme,
  Audience,
  AudienceDuJour,
  CompteRenduAttendu,
  CreerAlarme,
  EntreeCalendrier,
  PlanifierAudience,
  ReprogrammerAlarme,
} from "@/types/domaine";
import type { PeriodeCalendrier } from "@/types/enums";

/**
 * Hearings, alarms and calendar (#13 to #17, #56, #57): 1:1 mirror of the endpoints. The backend
 * owns the rules (step `EN_COURS`, future date, report after the hearing); the UI replays them only
 * to avoid offering actions bound to fail.
 */
export const audienceService = {
  /** #56: hearings of a case, most recent first. */
  listerAudiences: async (dossierId: number, page = 0, size = TAILLE_PAGE): Promise<PageReponse<Audience>> => {
    const { data } = await apiClient.get<PageReponse<Audience>>(`/dossiers/${dossierId}/audiences`, {
      params: { page, size },
    });
    return data;
  },

  /**
   * #13: scheduling. A duplicate (same step, same date) returns `ERR-005`, a confirmation request
   * replayed with `forcer`; the backend then alerts the DJ.
   */
  planifier: async (dossierId: number, audience: PlanifierAudience, forcer = false): Promise<Audience> => {
    const { data } = await apiClient.post<Audience>(`/dossiers/${dossierId}/audiences`, audience, {
      params: forcer ? { forcer: true } : {},
    });
    return data;
  },

  /** Note addressed to the retained lawyer, separate from the internal report. Empty clears it. */
  modifierNoteAvocat: async (audienceId: number, note: string): Promise<Audience> => {
    const { data } = await apiClient.put<Audience>(`/audiences/${audienceId}/note-avocat`, { note });
    return data;
  },

  /** #14: hearing report, only accepted on or after the hearing date. */
  enregistrerCompteRendu: async (audienceId: number, compteRendu: string): Promise<Audience> => {
    const { data } = await apiClient.put<Audience>(`/audiences/${audienceId}/compte-rendu`, { compteRendu });
    return data;
  },

  /**
   * Reasoned cancellation of a scheduled hearing (adjournment, wrong date). It leaves the calendar,
   * exports and reminders; postponing means cancelling and rescheduling.
   */
  annuler: async (audienceId: number, motif: string): Promise<Audience> => {
    const { data } = await apiClient.patch<Audience>(`/audiences/${audienceId}/annulation`, { motif });
    return data;
  },

  /** #57: alarms of a case, nearest due date first. */
  listerAlarmes: async (dossierId: number, page = 0, size = TAILLE_PAGE): Promise<PageReponse<Alarme>> => {
    const { data } = await apiClient.get<PageReponse<Alarme>>(`/dossiers/${dossierId}/alarmes`, {
      params: { page, size },
    });
    return data;
  },

  /** #16 */
  creerAlarme: async (dossierId: number, alarme: CreerAlarme): Promise<Alarme> => {
    const { data } = await apiClient.post<Alarme>(`/dossiers/${dossierId}/alarmes`, alarme);
    return data;
  },

  /** #17: closes the alarm and creates a new one; the new one is returned. */
  reprogrammerAlarme: async (alarmeId: number, reprogrammation: ReprogrammerAlarme): Promise<Alarme> => {
    const { data } = await apiClient.put<Alarme>(`/alarmes/${alarmeId}/reprogrammer`, reprogrammation);
    return data;
  },

  /** Closes a handled alarm without replacing it. */
  traiterAlarme: async (alarmeId: number): Promise<Alarme> => {
    const { data } = await apiClient.patch<Alarme>(`/alarmes/${alarmeId}/traiter`);
    return data;
  },

  /** #15, JSON: non-cancelled hearings of the period, unpaginated and not filtered by legal officer. */
  calendrier: async (periode: PeriodeCalendrier, dateDebut: string): Promise<EntreeCalendrier[]> => {
    const { data } = await apiClient.get<EntreeCalendrier[]>("/audiences/calendrier", {
      params: { periode, dateDebut, format: "JSON" },
    });
    return data;
  },

  /** Screen 44: hearings of one day, with both reports. */
  journal: async (date: string, page = 0, size = TAILLE_PAGE): Promise<PageReponse<AudienceDuJour>> => {
    const { data } = await apiClient.get<PageReponse<AudienceDuJour>>("/audiences/journal", {
      params: { date, page, size },
    });
    return data;
  },

  /**
   * Screen 44: past hearings missing the legal officer's report, over an explicit window. The
   * backend caps the upper bound at yesterday, since today's hearings are not yet overdue.
   */
  comptesRendusAttendus: async (
    dateDebut: string,
    dateFin: string,
    page = 0,
    size = TAILLE_PAGE,
  ): Promise<PageReponse<CompteRenduAttendu>> => {
    const { data } = await apiClient.get<PageReponse<CompteRenduAttendu>>("/audiences/comptes-rendus-attendus", {
      params: { dateDebut, dateFin, page, size },
    });
    return data;
  },

  /**
   * #15, PDF or Excel: the binary document. Errors also arrive as binary; the HTTP client
   * interceptor decodes them so the backend message reaches the user.
   */
  exporterCalendrier: async (
    periode: PeriodeCalendrier,
    dateDebut: string,
    format: "PDF" | "EXCEL",
  ): Promise<Blob> => {
    const { data } = await apiClient.get<Blob>("/audiences/calendrier", {
      params: { periode, dateDebut, format },
      responseType: "blob",
    });
    // Browsers return a `Blob` but axios returns a Buffer under Node; normalize for callers.
    return data instanceof Blob ? data : new Blob([data as BlobPart]);
  },
};

