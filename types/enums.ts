/**
 * Les 28 énumérations du domaine **effectivement exposées par l'API**, relevées une par une dans le
 * code du backend et recoupées avec `contracts/openapi.json`.
 *
 * Le backend en définit 31 ; trois sont internes et ne franchissent jamais l'API (voir en fin de
 * fichier).
 *
 * **Ce fichier ne contient que le contrat — aucun libellé.** Le backend renvoie les valeurs brutes
 * (`EN_DELIBERE`, `DEPOSEE`, …) sans traduction ; les libellés vivent dans `messages/fr.json` et
 * `messages/en.json`, sous l'espace `domaine`, et se résolvent par `lib/libelles.ts`. C'est ce qui
 * rend l'application bilingue sans modification du backend.
 *
 * `tests/unit/messages.test.ts` vérifie que **chaque valeur ci-dessous a un libellé dans les deux
 * langues** : ajouter une valeur ici sans la traduire fait échouer la suite.
 */

// ─────────────────────────────── Dossier ───────────────────────────────

export const CategorieDossier = ["RECOUVREMENT", "EXPLOITATION_LITIGES"] as const;
export type CategorieDossier = (typeof CategorieDossier)[number];

export const TypeEtape = ["INSTANCE", "RECOURS_1", "RECOURS_2"] as const;
export type TypeEtape = (typeof TypeEtape)[number];

/** Cycle de vie d'une étape (RG-DOS-04). L'ordre du tableau est celui de la progression. */
export const StatutCycleVie = [
  "OUVERTURE",
  "EN_COURS",
  "EN_DELIBERE",
  "DELIBERE_VIDE",
  "CLOTURE",
  "ARCHIVE",
] as const;
export type StatutCycleVie = (typeof StatutCycleVie)[number];

export const StatutValidation = ["EN_ATTENTE", "VALIDEE", "REJETEE"] as const;
export type StatutValidation = (typeof StatutValidation)[number];

export const SeuilOrigine = ["GLOBAL", "DEROGATION"] as const;
export type SeuilOrigine = (typeof SeuilOrigine)[number];

// ─────────────────────────────── Audience ───────────────────────────────

export const StatutAudience = ["PLANIFIEE", "TENUE", "ANNULEE"] as const;
export type StatutAudience = (typeof StatutAudience)[number];

export const StatutAlarme = ["ACTIVE", "TRAITEE"] as const;
export type StatutAlarme = (typeof StatutAlarme)[number];

export const PeriodeCalendrier = ["HEBDOMADAIRE", "MENSUELLE", "TRIMESTRIELLE"] as const;
export type PeriodeCalendrier = (typeof PeriodeCalendrier)[number];

/** Export du calendrier des audiences — pas de CSV, contrairement aux rapports. */
export const FormatExport = ["JSON", "PDF", "EXCEL"] as const;
export type FormatExport = (typeof FormatExport)[number];

// ─────────────────────────────── Délibéré ───────────────────────────────

export const ResultatDelibere = ["FAVORABLE", "DEFAVORABLE", "MIXTE"] as const;
export type ResultatDelibere = (typeof ResultatDelibere)[number];

export const StatutExpedition = ["A_LEVER", "LEVEE"] as const;
export type StatutExpedition = (typeof StatutExpedition)[number];

/** Dérivé par le backend (Q-78), jamais stocké : en attente de décision, vidé, ou rabattu. */
export const EtatDelibere = ["EN_ATTENTE", "VIDE", "RABATTU"] as const;
export type EtatDelibere = (typeof EtatDelibere)[number];

// ─────────────────────────────── Frais ───────────────────────────────

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
 * Décisions du circuit, exposées depuis Q-82 backend (`DemandeFraisResponse.validations`) : deux
 * contrôles individuels, puis les deux accords **distincts** de la validation conjointe (US 4.5).
 */
export const EtapeValidationFrais = ["CONFORMITE", "OPPORTUNITE", "CONJOINTE_DJ", "CONJOINTE_DJA"] as const;
export type EtapeValidationFrais = (typeof EtapeValidationFrais)[number];

export const DecisionValidationFrais = ["ACCORD", "REJET"] as const;
export type DecisionValidationFrais = (typeof DecisionValidationFrais)[number];

// ─────────────────────────────── Publications ───────────────────────────────

export const TypePublication = ["CR_AUDIENCE", "AUTRE"] as const;
export type TypePublication = (typeof TypePublication)[number];

export const TypeAutrePublication = ["PIECE", "DECISION", "CONCLUSION"] as const;
export type TypeAutrePublication = (typeof TypeAutrePublication)[number];

export const StatutPublication = ["DEPOSE", "VALIDE", "REJETE"] as const;
export type StatutPublication = (typeof StatutPublication)[number];

// ─────────────────────────────── Intervenants ───────────────────────────────

export const TypeIntervenant = ["AVOCAT", "AUTRE_PRESTATAIRE"] as const;
export type TypeIntervenant = (typeof TypeIntervenant)[number];

export const StatutConstitution = ["EN_ATTENTE", "VALIDEE", "REJETEE"] as const;
export type StatutConstitution = (typeof StatutConstitution)[number];

// ─────────────────────────────── GED ───────────────────────────────

export const FormatDocument = ["PDF", "PNG", "JPG", "TXT", "XLSX"] as const;
export type FormatDocument = (typeof FormatDocument)[number];

export const StatutSuppression = ["EN_ATTENTE", "APPROUVEE", "REJETEE"] as const;
export type StatutSuppression = (typeof StatutSuppression)[number];

// ─────────────────────────────── Alertes ───────────────────────────────

export const StatutAlerte = ["DECLENCHEE", "TRAITEE"] as const;
export type StatutAlerte = (typeof StatutAlerte)[number];

export const CanalAlerte = ["APPLICATIF", "OUTLOOK", "TEAMS"] as const;
export type CanalAlerte = (typeof CanalAlerte)[number];

/** Les 17 types d'alerte (arbitrage backend Q-22). */
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
] as const;
export type TypeAlerte = (typeof TypeAlerte)[number];

// ─────────────────────────────── Configurations ───────────────────────────────

/**
 * Nature de la valeur attendue par une clé de configuration (backend Q-91). Le contrat décrit la
 * saisie — bornes d'un entier, valeurs acceptées d'une liste — au lieu de la faire redéclarer ici.
 *
 * Absente d'`ENUMERATIONS_TRADUITES` : elle ne s'affiche jamais. C'est un descripteur de contrat,
 * qui dit à l'écran 41 quel champ construire — pas un mot à montrer à l'utilisateur.
 */
export const TypeValeurConfiguration = ["ENTIER", "LISTE"] as const;
export type TypeValeurConfiguration = (typeof TypeValeurConfiguration)[number];

// ─────────────────────────────── Décisions définitives ───────────────────────────────

/*
 * `TypeDecisionDefinitive` n'est pas typée ici : c'est le discriminant de la hiérarchie JPA côté
 * backend. L'API expose deux réponses distinctes, jamais le discriminant lui-même.
 */

export const SensCondamnation = ["BANQUE_REDEVABLE", "TIERS_REDEVABLE"] as const;
export type SensCondamnation = (typeof SensCondamnation)[number];

export const StatutPaiementCondamnation = ["EN_ATTENTE", "PAYE", "RECOUVREMENT_FORCE"] as const;
export type StatutPaiementCondamnation = (typeof StatutPaiementCondamnation)[number];

export const TypeArchiveJurisprudence = ["EXTRAIT_MINUTE", "EXPEDITION", "GROSSE"] as const;
export type TypeArchiveJurisprudence = (typeof TypeArchiveJurisprudence)[number];

// ─────────────────────────────── Reporting ───────────────────────────────

export const TypeRapport = [
  "JOURNALIER",
  "HEBDOMADAIRE",
  "MENSUEL",
  "TRIMESTRIEL",
  "ANNUEL",
] as const;
export type TypeRapport = (typeof TypeRapport)[number];

/** Export d'un rapport — inclut CSV, contrairement au calendrier des audiences. */
export const FormatRapport = ["JSON", "PDF", "EXCEL", "CSV"] as const;
export type FormatRapport = (typeof FormatRapport)[number];

// ─────────────────────────────── Rôles ───────────────────────────────

/**
 * Rôles Keycloak. Un utilisateur en porte **plusieurs simultanément** : son profil métier, plus
 * `ROLE_CONSULTATION` (les 5 profils internes) et `ROLE_SAISIE` (composite).
 * Vérifié en réel : `juriste.test` → `["ROLE_JURISTE","ROLE_SAISIE","ROLE_CONSULTATION"]`,
 * `avocat.test` → `["ROLE_AVOCAT"]` seul.
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

/** Profils métier, à l'exclusion des rôles transverses. Ordre d'affichage hiérarchique. */
export const PROFILS_METIER = [
  "ROLE_DJ",
  "ROLE_DJA",
  "ROLE_SH",
  "ROLE_ASSISTANTE",
  "ROLE_JURISTE",
  "ROLE_AVOCAT",
] as const satisfies readonly Role[];

/** Espaces de traduction des énumérations, sous `domaine` dans les fichiers de messages. */
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
  SensCondamnation,
  StatutPaiementCondamnation,
  TypeArchiveJurisprudence,
  TypeRapport,
  FormatRapport,
} as const;
