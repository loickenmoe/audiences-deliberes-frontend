/**
 * Domain enumerations exposed by the API, checked against the backend code and
 * `contracts/openapi.json`.
 *
 * Contract only, no labels: labels live in `messages/fr.json` and `messages/en.json` under the
 * `domaine` namespace and are resolved by `lib/libelles.ts`. `tests/unit/messages.test.ts` checks
 * that every value below has a label in both languages.
 */

// Case files

export const CategorieDossier = ["RECOUVREMENT", "EXPLOITATION_LITIGES"] as const;
export type CategorieDossier = (typeof CategorieDossier)[number];

export const TypeEtape = ["INSTANCE", "RECOURS_1", "RECOURS_2", "RECOURS_2_CCJA"] as const;
export type TypeEtape = (typeof TypeEtape)[number];

/** Stage lifecycle (RG-DOS-04). Array order is the progression order. */
export const StatutCycleVie = [
  "OUVERTURE",
  "EN_COURS",
  "EN_DELIBERE",
  "DELIBERE_VIDE",
  "CLOTURE",
  "ARCHIVE",
] as const;
export type StatutCycleVie = (typeof StatutCycleVie)[number];

/**
 * Sort options for the case file list. Closed vocabulary mirroring the server enum: the browser
 * never names a column, it picks a sort.
 */
export const TriDossiers = ["RECENT", "ANCIEN", "REFERENCE", "RISQUE"] as const;
export type TriDossiers = (typeof TriDossiers)[number];

export const StatutValidation = ["EN_ATTENTE", "VALIDEE", "REJETEE"] as const;
export type StatutValidation = (typeof StatutValidation)[number];

export const SeuilOrigine = ["GLOBAL", "DEROGATION"] as const;
export type SeuilOrigine = (typeof SeuilOrigine)[number];

// Hearings

export const StatutAudience = ["PLANIFIEE", "TENUE", "ANNULEE"] as const;
export type StatutAudience = (typeof StatutAudience)[number];

export const StatutAlarme = ["ACTIVE", "TRAITEE"] as const;
export type StatutAlarme = (typeof StatutAlarme)[number];

export const PeriodeCalendrier = ["HEBDOMADAIRE", "MENSUELLE", "TRIMESTRIELLE"] as const;
export type PeriodeCalendrier = (typeof PeriodeCalendrier)[number];

/** Hearings calendar export: no CSV, unlike reports. */
export const FormatExport = ["JSON", "PDF", "EXCEL"] as const;
export type FormatExport = (typeof FormatExport)[number];

// Deliberations

export const ResultatDelibere = ["FAVORABLE", "DEFAVORABLE", "MIXTE"] as const;
export type ResultatDelibere = (typeof ResultatDelibere)[number];

export const StatutExpedition = ["A_LEVER", "LEVEE"] as const;
export type StatutExpedition = (typeof StatutExpedition)[number];

/** Derived by the backend, never stored: awaiting decision, delivered, or withdrawn. */
export const EtatDelibere = ["EN_ATTENTE", "VIDE", "RABATTU"] as const;
export type EtatDelibere = (typeof EtatDelibere)[number];

// Lawyer fees

export const StatutCircuitFrais = [
  "DEPOSEE",
  "CONFORMITE",
  "OPPORTUNITE",
  "VALIDEE",
  "REJETEE",
  "PAYEE",
] as const;
export type StatutCircuitFrais = (typeof StatutCircuitFrais)[number];

export const StatutPaiementFrais = ["EN_ATTENTE", "PAYEE"] as const;
export type StatutPaiementFrais = (typeof StatutPaiementFrais)[number];

/**
 * Workflow decisions (`DemandeFraisResponse.validations`): two individual checks, then the two
 * separate approvals of the joint validation (US 4.5).
 */
export const EtapeValidationFrais = ["CONFORMITE", "OPPORTUNITE", "CONJOINTE_DJ", "CONJOINTE_DJA"] as const;
export type EtapeValidationFrais = (typeof EtapeValidationFrais)[number];

export const DecisionValidationFrais = ["ACCORD", "REJET"] as const;
export type DecisionValidationFrais = (typeof DecisionValidationFrais)[number];

// Publications

export const TypePublication = ["CR_AUDIENCE", "AUTRE"] as const;
export type TypePublication = (typeof TypePublication)[number];

export const TypeAutrePublication = ["PIECE", "DECISION", "CONCLUSION"] as const;
export type TypeAutrePublication = (typeof TypeAutrePublication)[number];

export const StatutPublication = ["DEPOSE", "VALIDE", "REJETE"] as const;
export type StatutPublication = (typeof StatutPublication)[number];

// External parties

export const TypeIntervenant = ["AVOCAT", "AUTRE_PRESTATAIRE"] as const;
export type TypeIntervenant = (typeof TypeIntervenant)[number];

export const StatutConstitution = ["EN_ATTENTE", "VALIDEE", "REJETEE"] as const;
export type StatutConstitution = (typeof StatutConstitution)[number];

// Document management

export const FormatDocument = ["PDF", "PNG", "JPG", "TXT", "XLSX"] as const;
export type FormatDocument = (typeof FormatDocument)[number];

export const StatutSuppression = ["EN_ATTENTE", "APPROUVEE", "REJETEE"] as const;
export type StatutSuppression = (typeof StatutSuppression)[number];

// Alerts

export const StatutAlerte = ["DECLENCHEE", "TRAITEE"] as const;
export type StatutAlerte = (typeof StatutAlerte)[number];

export const CanalAlerte = ["APPLICATIF", "OUTLOOK", "TEAMS"] as const;
export type CanalAlerte = (typeof CanalAlerte)[number];

/** External channels for providers; internal users go through Outlook and Teams. */
export const CanalPrestataire = ["COURRIEL_PERSONNEL", "SMS", "WHATSAPP"] as const;
export type CanalPrestataire = (typeof CanalPrestataire)[number];

/**
 * Events notified to providers through an external channel. Must list every backend value: the
 * label test iterates over it, so a missing value would show its raw code on screen.
 */
export const EvenementPrestataire = [
  "CONSTITUTION_VALIDEE",
  "FRAIS_REJETES",
  "PAIEMENT_EFFECTUE",
  "PUBLICATION_ARBITREE",
  "CORRESPONDANCE_TRANSMISE",
  "RAPPEL_AUDIENCE",
  "AFFECTATION_DOSSIER",
  "DELAI_RECOURS",
  "SUPPRESSION_DOCUMENT_ARBITREE",
  "COMPTE_RENDU_ATTENDU",
  "COMPTE_RENDU_RECU",
  "DEMANDE_EXPLICATION",
] as const;
export type EvenementPrestataire = (typeof EvenementPrestataire)[number];

/**
 * Alert types. `MANQUEMENT_COMPTE_RENDU`: two consecutive hearings without a report are escalated to
 * the Legal Director. Any value added here requires a backend migration of the `chk_alerte_type`
 * constraint.
 */
export const TypeAlerte = [
  "RAPPEL_AUDIENCE",
  "DELAI_RECOURS",
  "PROROGATION",
  "ALARME",
  "DOUBLON_AFFECTATION",
  "DOUBLON_AUDIENCE",
  "DOUBLON_FACTURE",
  "NOUVELLE_DEMANDE_FRAIS",
  "VALIDATION_CONJOINTE_REQUISE",
  "PAIEMENT_EFFECTUE",
  "NOUVELLE_PUBLICATION",
  "DOCUMENT_CHARGE",
  "SUPPRESSION_DOCUMENT",
  "CONSTITUTION_A_SIGNER",
  "CHARGE_MAX_AVOCAT",
  "DELIBERE_ATTENDU",
  "DOSSIER_INCOMPLET",
  "MANQUEMENT_COMPTE_RENDU",
  "DEMANDE_EXPLICATION",
] as const;
export type TypeAlerte = (typeof TypeAlerte)[number];

// Configuration

/**
 * Kind of value expected by a configuration key; the contract describes the input (integer bounds,
 * accepted list values). Absent from `ENUMERATIONS_TRADUITES`: it tells the screen which input to
 * build and is never displayed.
 */
export const TypeValeurConfiguration = ["ENTIER", "LISTE"] as const;
export type TypeValeurConfiguration = (typeof TypeValeurConfiguration)[number];

// Final decisions

/*
 * `TypeDecisionDefinitive` is not typed here: it is the backend JPA hierarchy discriminator. The API
 * exposes two distinct responses, never the discriminator itself.
 */

export const SensCondamnation = ["BANQUE_REDEVABLE", "TIERS_REDEVABLE"] as const;
export type SensCondamnation = (typeof SensCondamnation)[number];

export const StatutPaiementCondamnation = ["EN_ATTENTE", "PAYE", "RECOUVREMENT_FORCE"] as const;
export type StatutPaiementCondamnation = (typeof StatutPaiementCondamnation)[number];

export const TypeArchiveJurisprudence = ["EXTRAIT_MINUTE", "EXPEDITION", "GROSSE"] as const;
export type TypeArchiveJurisprudence = (typeof TypeArchiveJurisprudence)[number];

// Reporting

export const TypeRapport = [
  "JOURNALIER",
  "HEBDOMADAIRE",
  "MENSUEL",
  "TRIMESTRIEL",
  "ANNUEL",
] as const;
export type TypeRapport = (typeof TypeRapport)[number];

/** Report export: includes CSV, unlike the hearings calendar. */
export const FormatRapport = ["JSON", "PDF", "EXCEL", "CSV"] as const;
export type FormatRapport = (typeof FormatRapport)[number];

// Roles

/**
 * Keycloak roles. A user holds several at once: their business profile plus `ROLE_CONSULTATION`
 * (the 5 internal profiles) and `ROLE_SAISIE` (composite). A lawyer holds `ROLE_AVOCAT` only.
 */
export const Role = [
  "ROLE_JURISTE",
  "ROLE_DJ",
  "ROLE_DJA",
  "ROLE_ASSISTANTE",
  "ROLE_SH",
  "ROLE_AVOCAT",
  "ROLE_CONSULTATION",
  "ROLE_SAISIE",
] as const;
export type Role = (typeof Role)[number];

/** Business profiles, excluding cross-cutting roles, in hierarchical display order. */
export const PROFILS_METIER = [
  "ROLE_DJ",
  "ROLE_DJA",
  "ROLE_SH",
  "ROLE_ASSISTANTE",
  "ROLE_JURISTE",
  "ROLE_AVOCAT",
] as const satisfies readonly Role[];

/** Enum translation namespaces, under `domaine` in the message files. */
export const ENUMERATIONS_TRADUITES = {
  CategorieDossier,
  TypeEtape,
  StatutCycleVie,
  StatutValidation,
  SeuilOrigine,
  StatutAudience,
  StatutAlarme,
  PeriodeCalendrier,
  FormatExport,
  ResultatDelibere,
  StatutExpedition,
  EtatDelibere,
  StatutCircuitFrais,
  StatutPaiementFrais,
  EtapeValidationFrais,
  DecisionValidationFrais,
  TypePublication,
  TypeAutrePublication,
  StatutPublication,
  TypeIntervenant,
  StatutConstitution,
  FormatDocument,
  StatutSuppression,
  StatutAlerte,
  CanalAlerte,
  TypeAlerte,
  CanalPrestataire,
  EvenementPrestataire,
  SensCondamnation,
  StatutPaiementCondamnation,
  TypeArchiveJurisprudence,
  TypeRapport,
  FormatRapport,
} as const;
