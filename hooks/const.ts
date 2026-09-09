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
  intervenants: "intervenants",
  naturesDossier: "natures-dossier",
  typesClientSensible: "types-client-sensible",
  utilisateurs: "utilisateurs",
} as const;

/**
 * Durée de fraîcheur des référentiels.
 *
 * Natures de dossier, types de client sensible et annuaire interne changent au rythme d'une
 * décision d'administration, pas d'une session de travail. Les recharger à chaque écran serait du
 * gaspillage — et ces listes ne sont pas paginées côté backend (RF-05).
 */
export const FRAICHEUR_REFERENTIEL = 30 * 60 * 1000;
