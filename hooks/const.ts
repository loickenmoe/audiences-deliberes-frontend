/**
 * Centralized TanStack Query cache keys, so query and invalidation keys cannot silently diverge.
 */
export const CLES = {
  clients: "clients",
  client: "client",
  clientDossiers: "client-dossiers",
  dossiers: "dossiers",
  dossier: "dossier",
  documentsDossier: "documents-dossier",
  demandesSuppression: "demandes-suppression",
  partagesAvocat: "partages-avocat",
  etatPartageDossier: "etat-partage-dossier",
  piecesDossierAvocat: "pieces-dossier-avocat",
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
  agences: "agences",
  maSignature: "ma-signature",
  demandesExplication: "demandes-explication",
  naturesDossier: "natures-dossier",
  typesClientSensible: "types-client-sensible",
  utilisateurs: "utilisateurs",
} as const;

/**
 * Table page size (ten, so a table fits without scrolling) and the sizes the user can pick.
 * Tables only: pickers and counters have their own sizes below.
 */
export const TAILLE_PAGE = 10;

export const TAILLES_PAGE = [10, 25, 50] as const;

/** Size requested by a counter, which only reads `totalElements`. */
export const TAILLE_COMPTEUR = 1;

/**
 * Size used when a whole reference list is needed: the id-to-name lookup table (`useLibelles`) and
 * pickers without server search. Beyond this size the list would be silently truncated; pickers
 * should prefer server-side search.
 */
export const TAILLE_ANNUAIRE = 500;

/**
 * Freshness of reference data (case natures, sensitive client types, user directory), which only
 * change through administration and are not paginated by the backend (RF-05).
 */
export const FRAICHEUR_REFERENTIEL = 30 * 60 * 1000;

/**
 * Page size of a server-search picker. Twenty rather than ten so short search terms are not
 * silently truncated.
 */
export const TAILLE_SELECTEUR = 20;
