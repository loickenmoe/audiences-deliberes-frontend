import type { Role } from "@/types/enums";

/**
 * Contrôle d'accès du frontend.
 *
 * **Cette table est dérivée des `@PreAuthorize` du backend, jamais inventée.** Le backend reste
 * l'arbitre : chaque appel non autorisé est refusé côté serveur et remonte en `ERR-FORBIDDEN`.
 * Ce que l'on fait ici relève de l'ergonomie — ne pas proposer une action qui sera refusée — et non
 * de la sécurité. **Masquer n'est pas sécuriser.**
 *
 * Toute divergence entre cette table et un `@PreAuthorize` est un défaut : la référence est
 * `API_INTEGRATION_STATUS.md`, lui-même relevé endpoint par endpoint dans le code du backend.
 */

/** Les cinq profils internes. Tous portent `ROLE_CONSULTATION` et `ROLE_SAISIE` (composite). */
export const ROLES_INTERNES = [
  "ROLE_JURISTE",
  "ROLE_DJ",
  "ROLE_DJA",
  "ROLE_ASSISTANTE",
  "ROLE_SH",
] as const satisfies readonly Role[];

/** Un utilisateur porte plusieurs rôles simultanément : toujours raisonner en ensemble. */
export function aRole(roles: readonly string[] | undefined, ...attendus: readonly Role[]): boolean {
  if (!roles?.length) return false;
  return attendus.some((role) => roles.includes(role));
}

/** Profil métier principal, à l'exclusion des rôles transverses. Sert à l'affichage. */
export function profilPrincipal(roles: readonly string[] | undefined): Role | null {
  const ordre: readonly Role[] = [
    "ROLE_DJ",
    "ROLE_DJA",
    "ROLE_SH",
    "ROLE_ASSISTANTE",
    "ROLE_JURISTE",
    "ROLE_AVOCAT",
  ];
  return ordre.find((role) => roles?.includes(role)) ?? null;
}

/**
 * Capacités de l'interface. Chaque entrée cite le ou les endpoints dont elle reflète le
 * `@PreAuthorize`, pour que la correspondance reste vérifiable.
 */
export const CAPACITES = {
  // ── Dossiers ──────────────────────────────────────────────────────────────
  /** `GET /dossiers`, `GET /dossiers/{id}` — ROLE_CONSULTATION */
  consulterDossiers: ["ROLE_CONSULTATION"],
  /** `POST /dossiers` — ROLE_SAISIE */
  creerDossier: ["ROLE_SAISIE"],
  /** `PUT /dossiers/{id}/affectation` — JURISTE, DJ */
  modifierAffectation: ["ROLE_JURISTE", "ROLE_DJ"],
  /** `PATCH .../etapes/{etapeId}/statut`, `POST /dossiers/{id}/etapes` — JURISTE */
  gererEtapes: ["ROLE_JURISTE"],
  /** `POST /dossiers/{id}/seuil-derogation` — ROLE_SAISIE */
  demanderDerogationSeuil: ["ROLE_SAISIE"],
  /** `PUT .../seuil-derogation/{auditId}`, `POST .../sensibilite/validation` — DJ, DJA */
  arbitrerDossier: ["ROLE_DJ", "ROLE_DJA"],

  // ── Clients et référentiels ───────────────────────────────────────────────
  /** `GET /clients`, `GET /referentiels/*`, `GET /utilisateurs`, `GET /intervenants` — CONSULTATION */
  consulterReferentiels: ["ROLE_CONSULTATION"],
  /** `POST /clients` — ROLE_SAISIE */
  creerClient: ["ROLE_SAISIE"],
  /** `POST /intervenants` — DJ, DJA */
  administrerIntervenants: ["ROLE_DJ", "ROLE_DJA"],

  // ── Audiences et délibérés ────────────────────────────────────────────────
  /** `POST .../audiences`, `PUT /audiences/{id}/compte-rendu`, alarmes — JURISTE */
  gererAudiences: ["ROLE_JURISTE"],
  /** `GET /audiences/calendrier` — JURISTE, DJ (ni DJA ni Assistante) */
  consulterCalendrier: ["ROLE_JURISTE", "ROLE_DJ"],
  /** `POST .../deliberes`, prorogations, rabattement, expédition, recours — JURISTE */
  gererDeliberes: ["ROLE_JURISTE"],

  // ── Frais ─────────────────────────────────────────────────────────────────
  /** `GET /frais/demandes` — AVOCAT, ASSISTANTE, DJA, DJ */
  consulterFrais: ["ROLE_AVOCAT", "ROLE_ASSISTANTE", "ROLE_DJA", "ROLE_DJ"],
  /** `POST /frais/demandes` — AVOCAT */
  deposerFrais: ["ROLE_AVOCAT"],
  /** `PUT .../conformite`, `PATCH .../paiement` — ASSISTANTE */
  controlerConformiteFrais: ["ROLE_ASSISTANTE"],
  /** `PUT .../opportunite` — DJA */
  controlerOpportuniteFrais: ["ROLE_DJA"],
  /** `POST .../validation-conjointe` — DJ et DJA */
  validerConjointementFrais: ["ROLE_DJ", "ROLE_DJA"],

  // ── Publications et intervenants ──────────────────────────────────────────
  /** `GET /publications` — ASSISTANTE, JURISTE, DJ, DJA */
  consulterPublications: ["ROLE_ASSISTANTE", "ROLE_JURISTE", "ROLE_DJ", "ROLE_DJA"],
  /** `PUT /publications/{id}/validation` — ASSISTANTE */
  validerPublication: ["ROLE_ASSISTANTE"],
  /** `POST /publications/{id}/commentaires` — JURISTE */
  commenterPublication: ["ROLE_JURISTE"],
  /** `POST /publications/{id}/correspondance` — DJ, DJA */
  transmettreCorrespondance: ["ROLE_DJ", "ROLE_DJA"],
  /** `POST /publications/cr-audience`, `POST /publications/autres` — AVOCAT */
  deposerPublication: ["ROLE_AVOCAT"],
  /** `GET /repertoire/avocats` — JURISTE, ASSISTANTE (ni DJ ni DJA) */
  consulterRepertoire: ["ROLE_JURISTE", "ROLE_ASSISTANTE"],
  /** `GET /constitutions/prestataires`, `POST` — SH, JURISTE */
  consulterConstitutions: ["ROLE_SH", "ROLE_JURISTE"],
  /** `PUT /constitutions/prestataires/{id}/validation` — SH */
  signerConstitution: ["ROLE_SH"],

  // ── Gestion documentaire ──────────────────────────────────────────────────
  /** `POST /ged/documents` — ROLE_SAISIE */
  deposerDocument: ["ROLE_SAISIE"],
  /** `GET /ged/documents/{id}`, `GET /dossiers/{id}/documents` — CONSULTATION */
  consulterDocuments: ["ROLE_CONSULTATION"],
  /** `DELETE /ged/documents/{id}` — JURISTE (202) / DJ, DJA (200) */
  supprimerDocument: ["ROLE_JURISTE", "ROLE_DJ", "ROLE_DJA"],
  /** `GET /ged/demandes-suppression`, `PUT .../approbation-suppression` — DJ, DJA */
  arbitrerSuppressions: ["ROLE_DJ", "ROLE_DJA"],
  /** `GET /ged/rapport-journalier` — JURISTE */
  consulterRapportJournalier: ["ROLE_JURISTE"],

  // ── Décisions définitives ─────────────────────────────────────────────────
  /** adjudications, condamnations, jurisprudences (écriture) — JURISTE */
  gererDecisions: ["ROLE_JURISTE"],
  /** `GET /jurisprudences` — CONSULTATION */
  consulterJurisprudence: ["ROLE_CONSULTATION"],

  // ── Pilotage et administration ────────────────────────────────────────────
  /** `GET /tableau-de-bord` — DJ **seul** (cf. QF-04, arbitrage en attente) */
  consulterTableauDeBord: ["ROLE_DJ"],
  /** `GET /rapports` — JURISTE **seul** (cf. QF-04, arbitrage en attente) */
  genererRapport: ["ROLE_JURISTE"],
  /** `GET /configurations` — CONSULTATION */
  consulterConfigurations: ["ROLE_CONSULTATION"],
  /** `PUT /configurations/{cle}`, `PUT /alertes/seuils` — DJ */
  administrerConfigurations: ["ROLE_DJ"],
} as const satisfies Record<string, readonly Role[]>;

export type Capacite = keyof typeof CAPACITES;

/** Vrai si les rôles de l'utilisateur autorisent cette capacité. */
export function peut(roles: readonly string[] | undefined, capacite: Capacite): boolean {
  return aRole(roles, ...CAPACITES[capacite]);
}
