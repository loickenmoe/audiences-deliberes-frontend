import { apiClient } from "@/lib/api/client";
import type { Rapport, TableauDeBord } from "@/types/domaine";
import type { FormatRapport, TypeRapport } from "@/types/enums";

/** Bornes d'un rapport. `type` n'est qu'une étiquette de période (backend Q-63). */
export interface PeriodeRapport {
  type: TypeRapport;
  dateDebut: string;
  dateFin: string;
}

/**
 * Reporting (#49, #50).
 *
 * Deux profils distincts par conception : le tableau de bord est réservé au DJ (US 8.5), le rapport
 * au juriste (US 8.4). Le DJ portant aussi `ROLE_JURISTE` depuis Q-81, il atteint les deux — c'est
 * ce qui rend le parcours de pilotage P9 jouable et ce qui ferme QF-04.
 */
export const reportingService = {
  /** #50 — indicateurs temps réel, tous dossiers confondus. */
  tableauDeBord: async (): Promise<TableauDeBord> => {
    const { data } = await apiClient.get<TableauDeBord>("/tableau-de-bord");
    return data;
  },

  /**
   * #49 en JSON. **`null` quand le backend répond 204** : aucune activité sur la période. C'est un
   * état vide, pas une erreur — le distinguer ici évite que chaque écran réinterprète un statut.
   */
  genererRapport: async (periode: PeriodeRapport): Promise<Rapport | null> => {
    const reponse = await apiClient.get<Rapport | "">("/rapports", {
      params: { ...periode, format: "JSON" },
    });
    return reponse.status === 204 || !reponse.data ? null : (reponse.data as Rapport);
  },

  /**
   * #49 en PDF, Excel ou CSV — le document lui-même, en binaire. **`null` sur 204**, comme la
   * version JSON : il n'y a pas de fichier à télécharger pour une période sans activité.
   *
   * En réponse binaire, une erreur arrive elle aussi en binaire : c'est l'intercepteur du client
   * HTTP qui la relit, pour que le message du backend atteigne l'utilisateur.
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
    // Un navigateur rend un `Blob` ; sous Node, axios rend un tampon. Normaliser ici évite que
    // l'appelant dépende de l'environnement.
    const data = reponse.data;
    if (!data) return null;
    return data instanceof Blob ? data : new Blob([data as BlobPart]);
  },
};
