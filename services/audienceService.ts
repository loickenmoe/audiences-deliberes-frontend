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
 * Audiences, alarmes et calendrier (#13 à #17, #56, #57) — miroir 1:1 des endpoints.
 *
 * Les règles (étape `EN_COURS`, date future, compte rendu après l'audience) sont celles du backend ;
 * l'interface les rejoue pour ne pas proposer une action vouée au refus, mais c'est lui qui arbitre.
 */
export const audienceService = {
  /** #56 — audiences d'un dossier, la plus récente d'abord. */
  listerAudiences: async (dossierId: number, page = 0, size = TAILLE_PAGE): Promise<PageReponse<Audience>> => {
    const { data } = await apiClient.get<PageReponse<Audience>>(`/dossiers/${dossierId}/audiences`, {
      params: { page, size },
    });
    return data;
  },

  /**
   * #13 — planification. Un doublon (même étape, même date) renvoie `ERR-005` : ce n'est pas un
   * échec mais une demande de confirmation, rejouée avec `forcer` — le backend alerte alors le DJ.
   */
  planifier: async (dossierId: number, audience: PlanifierAudience, forcer = false): Promise<Audience> => {
    const { data } = await apiClient.post<Audience>(`/dossiers/${dossierId}/audiences`, audience, {
      params: forcer ? { forcer: true } : {},
    });
    return data;
  },

  /** #14 — compte rendu, recevable seulement le jour de l'audience ou après. */
  enregistrerCompteRendu: async (audienceId: number, compteRendu: string): Promise<Audience> => {
    const { data } = await apiClient.put<Audience>(`/audiences/${audienceId}/compte-rendu`, { compteRendu });
    return data;
  },

  /**
   * 🆕 Q-76 — annulation motivée d'une audience planifiée (renvoi, date erronée — QF-30). Elle sort
   * du calendrier, des exports et des rappels ; un report consiste à annuler, puis replanifier.
   */
  annuler: async (audienceId: number, motif: string): Promise<Audience> => {
    const { data } = await apiClient.patch<Audience>(`/audiences/${audienceId}/annulation`, { motif });
    return data;
  },

  /** #57 — alarmes d'un dossier, échéance la plus proche d'abord. */
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

  /** #17 — clôt l'alarme et en crée une nouvelle ; c'est la **nouvelle** qui est renvoyée. */
  reprogrammerAlarme: async (alarmeId: number, reprogrammation: ReprogrammerAlarme): Promise<Alarme> => {
    const { data } = await apiClient.put<Alarme>(`/alarmes/${alarmeId}/reprogrammer`, reprogrammation);
    return data;
  },

  /** 🆕 Q-77 — clôt une alarme traitée **sans** la remplacer (QF-29). */
  traiterAlarme: async (alarmeId: number): Promise<Alarme> => {
    const { data } = await apiClient.patch<Alarme>(`/alarmes/${alarmeId}/traiter`);
    return data;
  },

  /** #15, format JSON — les audiences de la période hors annulées, sans pagination ni filtre par juriste. */
  calendrier: async (periode: PeriodeCalendrier, dateDebut: string): Promise<EntreeCalendrier[]> => {
    const { data } = await apiClient.get<EntreeCalendrier[]>("/audiences/calendrier", {
      params: { periode, dateDebut, format: "JSON" },
    });
    return data;
  },

  /** Écran 44 — les audiences d'une journée, avec les deux comptes rendus. */
  journal: async (date: string, page = 0, size = TAILLE_PAGE): Promise<PageReponse<AudienceDuJour>> => {
    const { data } = await apiClient.get<PageReponse<AudienceDuJour>>("/audiences/journal", {
      params: { date, page, size },
    });
    return data;
  },

  /**
   * Écran 44 — les audiences passées dont le compte rendu du juriste manque.
   *
   * La fenêtre est explicite : sans bornes, la liste grossirait sans fin et cesserait d'être un
   * outil de rappel. Le backend ramène de lui-même la borne haute à hier — une audience du jour
   * n'est pas en retard, elle est en cours.
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
   * #15, format PDF ou Excel — le document lui-même, en binaire.
   *
   * En réponse binaire, une erreur arrive elle aussi en binaire : c'est l'intercepteur du client
   * HTTP qui la relit, pour que le message du backend atteigne l'utilisateur.
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
    // Un navigateur rend un `Blob` ; sous Node, axios rend un tampon. Normaliser ici évite que
    // l'appelant dépende de l'environnement.
    return data instanceof Blob ? data : new Blob([data as BlobPart]);
  },
};

