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
import type { FormatRapport, TypeRapport } from "@/types/enums";

/**
 * Qui l'on regarde, pour la fiche d'activité (Q-133, étendu aux avocats en Q-135).
 *
 * **Rien du tout signifie « moi »** : c'est le serveur qui sait qui je suis, et l'écran n'a donc pas
 * à transporter son propre identifiant. Un collègue se désigne par son **compte**, un avocat par son
 * **inscription au répertoire** - la direction le connaît par là, et l'identifiant d'utilisateur n'y
 * figure pas. Les deux ensemble sont refusés par le serveur : servir l'un en ignorant l'autre
 * laisserait croire qu'on a lu l'activité demandée.
 */
export type CibleActivite = { utilisateurId: number } | { avocatId: number };

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
   * L'activité de chacun sur une période (observation 14, N6) — DJ et DJA seuls.
   *
   * **`null` quand le backend répond 204**, comme le rapport périodique : une période sans activité
   * est un état vide, et une page de zéros laisserait croire que personne n'a rien fait.
   */
  rapportNominatif: async (dateDebut: string, dateFin: string): Promise<RapportNominatif | null> => {
    const reponse = await apiClient.get<RapportNominatif | "">("/rapports/nominatif", {
      params: { dateDebut, dateFin },
    });
    return reponse.status === 204 || !reponse.data ? null : (reponse.data as RapportNominatif);
  },

  /**
   * Le détail d'un bloc du tableau de bord (Q-137) — DJ et DJA.
   *
   * **Ce que le serveur garantit, et qui vaut d'être dit** : la liste rend exactement ce que le bloc
   * compte, prédicat pour prédicat. Le total de la page est donc celui du bloc - l'écran n'a pas à
   * recompter, et surtout il ne doit pas : sommer les lignes d'une page donnerait un chiffre plus
   * petit dès la deuxième.
   *
   * Paginé, parce qu'un bloc peut valoir trois cents : une modale qui charge tout met plus de temps
   * à s'ouvrir que l'utilisateur n'en met à renoncer.
   */
  detailTableauDeBord: async (
    indicateur: IndicateurTableauDeBord,
    page: number,
  ): Promise<PageReponse<DetailIndicateur>> => {
    const { data } = await apiClient.get<PageReponse<DetailIndicateur>>("/tableau-de-bord/details", {
      params: { indicateur, page, size: 20 },
    });
    return data;
  },

  /**
   * L'activité des avocats sur une période (Q-136) — DJ et DJA.
   *
   * Le pendant du rapport nominatif, pour l'autre population. Les deux ne tiennent pas dans un même
   * tableau : un avocat n'accomplit aucune des six natures de production interne que l'autre compte.
   *
   * **`null` sur 204**, comme les autres : aucun dépôt sur la période.
   */
  rapportAvocats: async (dateDebut: string, dateFin: string): Promise<RapportAvocats | null> => {
    const reponse = await apiClient.get<RapportAvocats | "">("/rapports/nominatif/avocats", {
      params: { dateDebut, dateFin },
    });
    return reponse.status === 204 || !reponse.data ? null : (reponse.data as RapportAvocats);
  },

  /**
   * La fiche d'activité d'une personne (Q-133) — **chacun sur lui-même**, le DJ et la DJA sur
   * quiconque.
   *
   * `utilisateurId` absent signifie « moi » : c'est le serveur qui sait qui je suis, et l'écran n'a
   * donc pas à transporter son propre identifiant. Renseigné, il n'est servi qu'à la direction - le
   * serveur refuse, l'écran ne le propose simplement pas aux autres.
   *
   * **`null` sur 204** : la personne n'a rien fait sur la période. Un état vide, pas une erreur.
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
   * La même fiche en document : « chaque utilisateur doit être capable de télécharger ses propres
   * rapports » (métier, 2026-10-09).
   *
   * Le nom du fichier vient du **serveur**, dans l'en-tête `Content-Disposition`, que CORS n'expose
   * pas en lecture — l'appelant le reconstruit donc avec `nomFichierActivite`, à partir des mêmes
   * éléments. Les deux doivent rester d'accord, et un test unitaire s'en assure.
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

  /**
   * Les actions derrière un décompte (Q-133) : « cliquer sur un élément doit renvoyer aux détails de
   * la dite tâche ».
   *
   * Paginé, parce qu'un décompte peut valoir cent : une modale qui charge cent lignes d'un coup met
   * plus de temps à s'ouvrir que l'utilisateur n'en met à renoncer.
   */
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
