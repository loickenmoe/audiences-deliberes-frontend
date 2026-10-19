import type { Role } from "@/types/enums";

/**
 * Frontend access control.
 *
 * This table is derived from the backend `@PreAuthorize` rules. The backend remains the authority
 * (unauthorized calls fail with `ERR-FORBIDDEN`); this is UX, not security: hiding is not securing.
 * Any divergence from a `@PreAuthorize` is a bug (reference: `API_INTEGRATION_STATUS.md`).
 */

/**
 * The five internal profiles. All hold `ROLE_CONSULTATION` and `ROLE_SAISIE` (composite).
 *
 * `ROLE_DJ` and `ROLE_DJA` also include `ROLE_JURISTE` (composite), so every legal-officer
 * capability below is open to them without being listed. `profilPrincipal` ranks DJ and DJA first.
 */
export const ROLES_INTERNES = [
  "ROLE_JURISTE",
  "ROLE_DJ",
  "ROLE_DJA",
  "ROLE_ASSISTANTE",
  "ROLE_SH",
] as const satisfies readonly Role[];

/** A user holds several roles at once: always reason on the set. */
export function aRole(roles: readonly string[] | undefined, ...attendus: readonly Role[]): boolean {
  if (!roles?.length) return false;
  return attendus.some((role) => roles.includes(role));
}

/** Main business profile, excluding cross-cutting roles. Used for display. */
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
 * UI capabilities. Each entry cites the endpoints whose `@PreAuthorize` it mirrors, so the mapping
 * stays verifiable.
 */
export const CAPACITES = {
  // Case files
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
  /**
   * `POST /dossiers/{id}/sensibilite/proposition` - SAISIE. Like the threshold waiver, the legal
   * officer only proposes; setting or removing directly belongs to `arbitrerDossier`.
   */
  proposerDiligence: ["ROLE_SAISIE"],
  /** `PUT .../seuil-derogation/{auditId}`, `POST .../sensibilite/validation` — DJ, DJA */
  arbitrerDossier: ["ROLE_DJ", "ROLE_DJA"],

  // Clients and reference data
  /** `GET /clients`, `GET /referentiels/*`, `GET /utilisateurs`, `GET /intervenants` — CONSULTATION */
  consulterReferentiels: ["ROLE_CONSULTATION"],
  /** `POST /clients` — ROLE_SAISIE */
  creerClient: ["ROLE_SAISIE"],
  /** `PUT /clients/{id}` — ROLE_SAISIE: whoever can create a client can fix a typo in it. */
  modifierClient: ["ROLE_SAISIE"],
  /** `POST /intervenants` — DJ, DJA */
  administrerIntervenants: ["ROLE_DJ", "ROLE_DJA"],

  // Hearings and deliberations
  /** `POST .../audiences`, `PUT /audiences/{id}/compte-rendu`, alarms — JURISTE */
  gererAudiences: ["ROLE_JURISTE"],
  /**
   * `GET /audiences/calendrier` — JURISTE, DJ. The DJA has access through her composite
   * `ROLE_JURISTE`; the Assistant does not.
   */
  consulterCalendrier: ["ROLE_JURISTE", "ROLE_DJ"],

  /**
   * Hearing log and expected hearing reports. Open to legal officers as well as management: they use
   * it daily and the expected reports are theirs.
   */
  consulterJournalAudiences: ["ROLE_JURISTE", "ROLE_DJ", "ROLE_DJA"],
  /** `POST .../deliberes`, extensions, withdrawal, certified copy, appeals — JURISTE */
  gererDeliberes: ["ROLE_JURISTE"],

  // Lawyer fees
  /** `GET /frais/demandes`, `GET /frais/demandes/{id}` — AVOCAT, ASSISTANTE, DJA, DJ */
  consulterFrais: ["ROLE_AVOCAT", "ROLE_ASSISTANTE", "ROLE_DJA", "ROLE_DJ"],
  /** `POST /frais/demandes` — AVOCAT */
  deposerFrais: ["ROLE_AVOCAT"],
  /** `PUT .../conformite` — ASSISTANTE */
  controlerConformiteFrais: ["ROLE_ASSISTANTE"],
  /** `PATCH .../paiement` — ASSISTANTE */
  enregistrerPaiementFrais: ["ROLE_ASSISTANTE"],
  /** `PUT .../opportunite` — DJA */
  controlerOpportuniteFrais: ["ROLE_DJA"],
  /** `POST .../validation-conjointe` — DJ and DJA */
  validerConjointementFrais: ["ROLE_DJ", "ROLE_DJA"],

  // Publications and external parties
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
  /**
   * `GET /repertoire/avocats` — JURISTE, ASSISTANTE. The DJ and the DJA also have access through
   * their composite `ROLE_JURISTE`; only the SH and lawyers are excluded.
   */
  consulterRepertoire: ["ROLE_JURISTE", "ROLE_ASSISTANTE"],
  /** `GET /constitutions/prestataires` — SH, JURISTE, ASSISTANTE */
  consulterConstitutions: ["ROLE_SH", "ROLE_JURISTE", "ROLE_ASSISTANTE"],
  /** `POST /constitutions/prestataires` — JURISTE, ASSISTANTE */
  solliciterConstitution: ["ROLE_JURISTE", "ROLE_ASSISTANTE"],
  /** `PUT /constitutions/prestataires/{id}/validation` — SH */
  signerConstitution: ["ROLE_SH"],
  /**
   * `PUT /constitutions/prestataires/{id}/lettre` — JURISTE, SH, ASSISTANTE.
   *
   * The role is deliberately not enough: the letter belongs to the requester, and the SH corrects it
   * before signing. The server decides per row through `redactionPossible`; this capability only
   * opens the screen.
   */
  redigerLettre: ["ROLE_JURISTE", "ROLE_SH", "ROLE_ASSISTANTE"],

  /**
   * `GET /demandes-explication` — DJ, DJA and AVOCAT. The server decides what each sees (management
   * all of theirs, a lawyer those addressed to them); the screen sends no scope parameter.
   */
  consulterExplications: ["ROLE_DJ", "ROLE_DJA", "ROLE_AVOCAT"],
  /** `POST /demandes-explication` — DJ and DJA only: management writes. */
  demanderExplication: ["ROLE_DJ", "ROLE_DJA"],
  /** `PUT /demandes-explication/{id}/reponse` — the lawyer, only for their own (403 otherwise). */
  repondreExplication: ["ROLE_AVOCAT"],

  /**
   * `GET /rapports/nominatif` — DJ and DJA only. This report names people, so it relies on their own
   * roles, never on the composite `ROLE_JURISTE` (every legal officer would see colleagues' activity).
   */
  consulterRapportNominatif: ["ROLE_DJ", "ROLE_DJA"],

  /**
   * `GET /rapports/activite` — one's own activity, for everyone, lawyers included (fee requests,
   * hearing reports, other publications, explanation answers). `ROLE_CONSULTATION` covers the five
   * internal profiles, `ROLE_AVOCAT` the lawyer. The server decides whose activity is read; reading
   * someone else's requires [[consulterRapportNominatif]].
   */
  consulterMonActivite: ["ROLE_CONSULTATION", "ROLE_AVOCAT"],

  // Screens open to every account
  /**
   * Home page `/`, open to every authenticated account, lawyers included. No endpoint governs it: a
   * single root for all profiles whose content adapts. The capability exists so the navigation entry
   * has one. `ROLE_CONSULTATION` plus `ROLE_AVOCAT` covers the whole population.
   */
  consulterAccueil: ["ROLE_CONSULTATION", "ROLE_AVOCAT"],
  /**
   * Own notifications, `GET /alertes/mes-notifications` — `@PreAuthorize("isAuthenticated()")`.
   *
   * Kept separate from [[consulterAccueil]] despite identical roles: this one mirrors an endpoint,
   * the other a screen. The server resolves the recipient from the token.
   */
  consulterSesNotifications: ["ROLE_CONSULTATION", "ROLE_AVOCAT"],

  // Document management
  /** `POST /ged/documents` — ROLE_SAISIE */
  deposerDocument: ["ROLE_SAISIE"],
  /** `GET /ged/documents/{id}`, `GET /dossiers/{id}/documents` — CONSULTATION */
  consulterDocuments: ["ROLE_CONSULTATION"],
  /** `DELETE /ged/documents/{id}` — JURISTE (202) / DJ, DJA (200) */
  supprimerDocument: ["ROLE_JURISTE", "ROLE_DJ", "ROLE_DJA"],
  /** `GET /ged/demandes-suppression`, `PUT .../approbation-suppression` — DJ, DJA */
  arbitrerSuppressions: ["ROLE_DJ", "ROLE_DJA"],
  /**
   * `PUT`, `DELETE /ged/documents/{id}/partage-avocat` — JURISTE, SH, ASSISTANTE (the DJ and the DJA
   * through their composite `ROLE_JURISTE`). Any of them shares without DJ approval; on a sensitive
   * case file the server turns the action into a proposal, except for the DJ and the DJA.
   */
  partagerDocument: ["ROLE_JURISTE", "ROLE_SH", "ROLE_ASSISTANTE"],
  /**
   * `PUT .../partage-avocat/arbitrage`, `GET /ged/partages-avocat` — DJ, DJA.
   *
   * Kept separate from `arbitrerSuppressions` despite identical roles: one decides a document is
   * deleted, the other that it leaves the bank.
   */
  arbitrerPartages: ["ROLE_DJ", "ROLE_DJA"],
  /** `PUT /audiences/{id}/note-avocat` — JURISTE: the note for the appointed lawyer. */
  ecrireNoteAvocat: ["ROLE_JURISTE"],
  /** `GET /ged/rapport-journalier` — JURISTE, DJ, DJA, ASSISTANTE */
  consulterRapportJournalier: ["ROLE_JURISTE", "ROLE_DJ", "ROLE_DJA", "ROLE_ASSISTANTE"],

  // Final decisions
  /** adjudications, convictions, case law (write) — JURISTE */
  gererDecisions: ["ROLE_JURISTE"],
  /** `GET /jurisprudences` — CONSULTATION */
  consulterJurisprudence: ["ROLE_CONSULTATION"],

  // Steering and administration
  /** `GET /tableau-de-bord` — DJ and DJA (US 8.5) */
  consulterTableauDeBord: ["ROLE_DJ", "ROLE_DJA"],
  /** `GET /rapports` — JURISTE; the DJ reaches it through his composite `ROLE_JURISTE` */
  genererRapport: ["ROLE_JURISTE"],
  /** `GET /configurations` — CONSULTATION */
  consulterConfigurations: ["ROLE_CONSULTATION"],
  /**
   * `PUT /configurations/{cle}`, `PUT /alertes/seuils` — DJ and DJA, for service continuity when the
   * DJ is absent. One-way only: the appropriateness check stays reserved to the DJA, otherwise
   * RG-INT-03 would lose the separation of its two steps.
   */
  administrerConfigurations: ["ROLE_DJ", "ROLE_DJA"],
  /**
   * `POST`, `PUT`, `DELETE /referentiels/agences` - DJ, DJA.
   *
   * Kept separate from `administrerConfigurations` despite identical roles: a threshold is tuned,
   * whereas a branch affects every case file carrying its code. Reading falls under
   * `consulterReferentiels`.
   */
  administrerAgences: ["ROLE_DJ", "ROLE_DJA"],
  /**
   * `GET /alertes/statistiques-diffusion` — DJ, DJA. Kept separate from `administrerConfigurations`:
   * a supervision read, not an administration write.
   */
  superviserAlertes: ["ROLE_DJ", "ROLE_DJA"],
  /**
   * `GET /historique` — DJ, DJA. Kept separate from `administrerConfigurations` and
   * `superviserAlertes`: reading a colleague's named activity concerns personal data (NF-CONF-01).
   */
  consulterAudit: ["ROLE_DJ", "ROLE_DJA"],
} as const satisfies Record<string, readonly Role[]>;

export type Capacite = keyof typeof CAPACITES;

/** True if the user's roles grant this capability. */
export function peut(roles: readonly string[] | undefined, capacite: Capacite): boolean {
  return aRole(roles, ...CAPACITES[capacite]);
}
