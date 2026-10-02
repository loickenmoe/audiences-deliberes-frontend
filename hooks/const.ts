/**
 * Clés de cache TanStack Query, centralisées.
 *
 * Une clé écrite en dur dans un écran finit tôt ou tard par diverger de celle utilisée pour
 * l'invalidation — et la liste ne se rafraîchit plus après une création, sans que rien n'échoue.
 */
export const CLES = {
  clients: "clients",
  client: "client",
  clientDossiers: "client-dossiers",
  dossiers: "dossiers",
  dossier: "dossier",
  documentsDossier: "documents-dossier",
  demandesSuppression: "demandes-suppression",
  rapportJournalier: "rapport-journalier",
  derogations: "derogations",
  audiencesDossier: "audiences-dossier",
  alarmesDossier: "alarmes-dossier",
  calendrier: "calendrier",
  journalAudiences: "journal-audiences",
  comptesRendusAttendus: "comptes-rendus-attendus",
  deliberesDossier: "deliberes-dossier",
  prorogations: "prorogations",
  recours: "recours",
  demandesFrais: "demandes-frais",
  demandeFrais: "demande-frais",
  publications: "publications",
  publication: "publication",
  constitutions: "constitutions",
  repertoire: "repertoire",
  decisionsDossier: "decisions-dossier",
  jurisprudences: "jurisprudences",
  tableauDeBord: "tableau-de-bord",
  mesDossiers: "mes-dossiers",
  mesAudiences: "mes-audiences",
  mesPublications: "mes-publications",
  mesConstitutions: "mes-constitutions",
  notifications: "notifications",
  configurations: "configurations",
  audit: "audit",
  intervenants: "intervenants",
  naturesDossier: "natures-dossier",
  typesClientSensible: "types-client-sensible",
  utilisateurs: "utilisateurs",
} as const;

/**
 * Taille de page des **tableaux**, et les tailles que l'utilisateur peut choisir.
 *
 * **Dix par défaut**, sur décision du porteur du projet : un tableau doit tenir dans la fenêtre sans
 * défilement. Le sélecteur existe parce que la règle a un revers — chercher un dossier parmi soixante
 * demande six pages là où un défilement suffisait. Dix pour lire, cinquante pour balayer.
 *
 * ⚠ Ne vaut que pour les tableaux. Les **sélecteurs** (listes déroulantes) et les **compteurs** ont
 * leurs propres besoins : un sélecteur borné à dix amputerait silencieusement le choix de
 * l'utilisateur, et un compteur n'a besoin que de `totalElements`, donc d'une seule ligne.
 */
export const TAILLE_PAGE = 10;

export const TAILLES_PAGE = [10, 25, 50] as const;

/**
 * Taille demandée par un **compteur** : il ne lit que `totalElements`, pas les lignes. Les cartes de
 * l'accueil rapatriaient jusqu'à vingt lignes complètes chacune pour afficher un nombre.
 */
export const TAILLE_COMPTEUR = 1;

/**
 * Taille demandée quand on a besoin de **tout** un référentiel, et non d'une page.
 *
 * Deux usages légitimes : une **table de correspondance** identifiant → nom (`useLibelles`), et un
 * sélecteur qui n'a pas encore de recherche. C'est un pis-aller assumé — au-delà de cette taille, la
 * table serait tronquée en silence. La réponse durable est celle de Q-105 : chercher côté serveur
 * plutôt que tout détenir, et c'est le chemin vers lequel les sélecteurs migrent.
 */
export const TAILLE_ANNUAIRE = 500;

/**
 * Durée de fraîcheur des référentiels.
 *
 * Natures de dossier, types de client sensible et annuaire interne changent au rythme d'une
 * décision d'administration, pas d'une session de travail. Les recharger à chaque écran serait du
 * gaspillage — et ces listes ne sont pas paginées côté backend (RF-05).
 */
export const FRAICHEUR_REFERENTIEL = 30 * 60 * 1000;
