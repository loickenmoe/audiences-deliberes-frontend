/**
 * Les 28 énumérations du domaine **effectivement exposées par l'API**, relevées une par une dans le
 * code du backend et recoupées avec `contracts/openapi.json`, avec leur libellé français d'affichage.
 *
 * Le backend en définit 31 ; trois sont internes et ne franchissent jamais l'API (voir plus bas).
 *
 * Le backend renvoie les valeurs brutes (`EN_DELIBERE`, `DEPOSEE`, …) ; aucun libellé n'est fourni
 * par l'API. Cette table est donc la **seule** source d'affichage : ne jamais formater une
 * énumération à la main dans un composant, ni afficher la valeur technique à l'utilisateur.
 */

// ─────────────────────────────── Dossier ───────────────────────────────

export const CategorieDossier = ["RECOUVREMENT", "EXPLOITATION_LITIGES"] as const;
export type CategorieDossier = (typeof CategorieDossier)[number];
export const libelleCategorieDossier: Record<CategorieDossier, string> = {
  RECOUVREMENT: "Recouvrement",
  EXPLOITATION_LITIGES: "Litiges d'exploitation",
};

export const TypeEtape = ["INSTANCE", "RECOURS_1", "RECOURS_2"] as const;
export type TypeEtape = (typeof TypeEtape)[number];
export const libelleTypeEtape: Record<TypeEtape, string> = {
  INSTANCE: "Instance",
  RECOURS_1: "Premier recours",
  RECOURS_2: "Second recours",
};

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
export const libelleStatutCycleVie: Record<StatutCycleVie, string> = {
  OUVERTURE: "Ouverture",
  EN_COURS: "En cours",
  EN_DELIBERE: "En délibéré",
  DELIBERE_VIDE: "Délibéré vidé",
  CLOTURE: "Clôturée",
  ARCHIVE: "Archivée",
};

export const StatutValidation = ["EN_ATTENTE", "VALIDEE", "REJETEE"] as const;
export type StatutValidation = (typeof StatutValidation)[number];
export const libelleStatutValidation: Record<StatutValidation, string> = {
  EN_ATTENTE: "En attente",
  VALIDEE: "Validée",
  REJETEE: "Rejetée",
};

export const SeuilOrigine = ["GLOBAL", "DEROGATION"] as const;
export type SeuilOrigine = (typeof SeuilOrigine)[number];
export const libelleSeuilOrigine: Record<SeuilOrigine, string> = {
  GLOBAL: "Seuil global",
  DEROGATION: "Dérogation validée",
};

// ─────────────────────────────── Audience ───────────────────────────────

export const StatutAudience = ["PLANIFIEE", "TENUE", "ANNULEE"] as const;
export type StatutAudience = (typeof StatutAudience)[number];
export const libelleStatutAudience: Record<StatutAudience, string> = {
  PLANIFIEE: "Planifiée",
  TENUE: "Tenue",
  ANNULEE: "Annulée",
};

export const StatutAlarme = ["ACTIVE", "TRAITEE"] as const;
export type StatutAlarme = (typeof StatutAlarme)[number];
export const libelleStatutAlarme: Record<StatutAlarme, string> = {
  ACTIVE: "Active",
  TRAITEE: "Traitée",
};

export const PeriodeCalendrier = ["HEBDOMADAIRE", "MENSUELLE", "TRIMESTRIELLE"] as const;
export type PeriodeCalendrier = (typeof PeriodeCalendrier)[number];
export const libellePeriodeCalendrier: Record<PeriodeCalendrier, string> = {
  HEBDOMADAIRE: "Semaine",
  MENSUELLE: "Mois",
  TRIMESTRIELLE: "Trimestre",
};

/** Export du calendrier des audiences — pas de CSV, contrairement aux rapports. */
export const FormatExport = ["JSON", "PDF", "EXCEL"] as const;
export type FormatExport = (typeof FormatExport)[number];
export const libelleFormatExport: Record<FormatExport, string> = {
  JSON: "Écran",
  PDF: "PDF",
  EXCEL: "Excel",
};

// ─────────────────────────────── Délibéré ───────────────────────────────

export const ResultatDelibere = ["FAVORABLE", "DEFAVORABLE", "MIXTE"] as const;
export type ResultatDelibere = (typeof ResultatDelibere)[number];
export const libelleResultatDelibere: Record<ResultatDelibere, string> = {
  FAVORABLE: "Favorable",
  DEFAVORABLE: "Défavorable",
  MIXTE: "Mixte",
};

export const StatutExpedition = ["A_LEVER", "LEVEE"] as const;
export type StatutExpedition = (typeof StatutExpedition)[number];
export const libelleStatutExpedition: Record<StatutExpedition, string> = {
  A_LEVER: "À lever",
  LEVEE: "Levée",
};

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
export const libelleStatutCircuitFrais: Record<StatutCircuitFrais, string> = {
  DEPOSEE: "Déposée",
  CONFORMITE: "Conformité contrôlée",
  OPPORTUNITE: "Validation conjointe attendue",
  VALIDEE: "Validée",
  REJETEE: "Rejetée",
  PAYEE: "Payée",
};

export const StatutPaiementFrais = ["EN_ATTENTE", "PAYEE"] as const;
export type StatutPaiementFrais = (typeof StatutPaiementFrais)[number];
export const libelleStatutPaiementFrais: Record<StatutPaiementFrais, string> = {
  EN_ATTENTE: "En attente de paiement",
  PAYEE: "Payée",
};

/*
 * `EtapeValidationFrais` et `DecisionValidationFrais` ne sont **pas** typées ici : vérifié contre
 * `contracts/openapi.json` et le code backend, elles vivent uniquement dans `domain/`, `service/`
 * et `repository/` — aucun DTO exposé ne les renvoie. Elles tracent en base les accords successifs
 * du circuit de validation ; l'interface, elle, lit `StatutCircuitFrais`. Les typer serait du poids
 * mort qui laisserait croire à une donnée disponible.
 */

// ─────────────────────────────── Publications ───────────────────────────────

export const TypePublication = ["CR_AUDIENCE", "AUTRE"] as const;
export type TypePublication = (typeof TypePublication)[number];
export const libelleTypePublication: Record<TypePublication, string> = {
  CR_AUDIENCE: "Compte rendu d'audience",
  AUTRE: "Autre publication",
};

export const TypeAutrePublication = ["PIECE", "DECISION", "CONCLUSION"] as const;
export type TypeAutrePublication = (typeof TypeAutrePublication)[number];
export const libelleTypeAutrePublication: Record<TypeAutrePublication, string> = {
  PIECE: "Pièce",
  DECISION: "Décision",
  CONCLUSION: "Conclusion",
};

export const StatutPublication = ["DEPOSE", "VALIDE", "REJETE"] as const;
export type StatutPublication = (typeof StatutPublication)[number];
export const libelleStatutPublication: Record<StatutPublication, string> = {
  DEPOSE: "Déposée",
  VALIDE: "Validée",
  REJETE: "Rejetée",
};

// ─────────────────────────────── Intervenants ───────────────────────────────

export const TypeIntervenant = ["AVOCAT", "AUTRE_PRESTATAIRE"] as const;
export type TypeIntervenant = (typeof TypeIntervenant)[number];
export const libelleTypeIntervenant: Record<TypeIntervenant, string> = {
  AVOCAT: "Avocat",
  AUTRE_PRESTATAIRE: "Autre prestataire",
};

export const StatutConstitution = ["EN_ATTENTE", "VALIDEE", "REJETEE"] as const;
export type StatutConstitution = (typeof StatutConstitution)[number];
export const libelleStatutConstitution: Record<StatutConstitution, string> = {
  EN_ATTENTE: "En attente de signature",
  VALIDEE: "Signée",
  REJETEE: "Rejetée",
};

// ─────────────────────────────── GED ───────────────────────────────

export const FormatDocument = ["PDF", "PNG", "JPG", "TXT", "XLSX"] as const;
export type FormatDocument = (typeof FormatDocument)[number];
export const libelleFormatDocument: Record<FormatDocument, string> = {
  PDF: "PDF",
  PNG: "Image PNG",
  JPG: "Image JPEG",
  TXT: "Texte",
  XLSX: "Classeur Excel",
};

export const StatutSuppression = ["EN_ATTENTE", "APPROUVEE", "REJETEE"] as const;
export type StatutSuppression = (typeof StatutSuppression)[number];
export const libelleStatutSuppression: Record<StatutSuppression, string> = {
  EN_ATTENTE: "En attente d'approbation",
  APPROUVEE: "Approuvée",
  REJETEE: "Rejetée",
};

// ─────────────────────────────── Alertes ───────────────────────────────

export const StatutAlerte = ["DECLENCHEE", "TRAITEE"] as const;
export type StatutAlerte = (typeof StatutAlerte)[number];
export const libelleStatutAlerte: Record<StatutAlerte, string> = {
  DECLENCHEE: "Non lue",
  TRAITEE: "Traitée",
};

export const CanalAlerte = ["APPLICATIF", "OUTLOOK", "TEAMS"] as const;
export type CanalAlerte = (typeof CanalAlerte)[number];
export const libelleCanalAlerte: Record<CanalAlerte, string> = {
  APPLICATIF: "Application",
  OUTLOOK: "Outlook",
  TEAMS: "Teams",
};

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
export const libelleTypeAlerte: Record<TypeAlerte, string> = {
  RAPPEL_AUDIENCE: "Rappel d'audience",
  DELAI_RECOURS: "Délai de recours",
  PROROGATION: "Prorogations répétées",
  ALARME: "Alarme arrivée à échéance",
  DOUBLON_AFFECTATION: "Doublon d'affectation",
  DOUBLON_AUDIENCE: "Doublon d'audience",
  DOUBLON_FACTURE: "Facture en double",
  NOUVELLE_DEMANDE_FRAIS: "Nouvelle demande de frais",
  VALIDATION_CONJOINTE_REQUISE: "Validation conjointe requise",
  PAIEMENT_EFFECTUE: "Paiement effectué",
  NOUVELLE_PUBLICATION: "Nouvelle publication",
  DOCUMENT_CHARGE: "Document ajouté",
  SUPPRESSION_DOCUMENT: "Suppression de document",
  CONSTITUTION_A_SIGNER: "Constitution à signer",
  CHARGE_MAX_AVOCAT: "Charge maximale d'un avocat",
  DELIBERE_ATTENDU: "Délibéré attendu",
  DOSSIER_INCOMPLET: "Dossier incomplet",
};

// ─────────────────────────────── Décisions définitives ───────────────────────────────

/*
 * `TypeDecisionDefinitive` n'est pas typée ici pour la même raison : c'est le discriminant de la
 * hiérarchie JPA côté backend. L'API expose deux réponses distinctes, `AdjudicationResponse` et
 * `CondamnationResponse`, jamais le discriminant lui-même.
 */

export const SensCondamnation = ["BANQUE_REDEVABLE", "TIERS_REDEVABLE"] as const;
export type SensCondamnation = (typeof SensCondamnation)[number];
export const libelleSensCondamnation: Record<SensCondamnation, string> = {
  BANQUE_REDEVABLE: "La banque est redevable",
  TIERS_REDEVABLE: "Le tiers est redevable",
};

export const StatutPaiementCondamnation = ["EN_ATTENTE", "PAYE", "RECOUVREMENT_FORCE"] as const;
export type StatutPaiementCondamnation = (typeof StatutPaiementCondamnation)[number];
export const libelleStatutPaiementCondamnation: Record<StatutPaiementCondamnation, string> = {
  EN_ATTENTE: "En attente",
  PAYE: "Payée",
  RECOUVREMENT_FORCE: "Recouvrement forcé",
};

export const TypeArchiveJurisprudence = ["EXTRAIT_MINUTE", "EXPEDITION", "GROSSE"] as const;
export type TypeArchiveJurisprudence = (typeof TypeArchiveJurisprudence)[number];
export const libelleTypeArchiveJurisprudence: Record<TypeArchiveJurisprudence, string> = {
  EXTRAIT_MINUTE: "Extrait de minute",
  EXPEDITION: "Expédition",
  GROSSE: "Grosse",
};

// ─────────────────────────────── Reporting ───────────────────────────────

export const TypeRapport = [
  "JOURNALIER",
  "HEBDOMADAIRE",
  "MENSUEL",
  "TRIMESTRIEL",
  "ANNUEL",
] as const;
export type TypeRapport = (typeof TypeRapport)[number];
export const libelleTypeRapport: Record<TypeRapport, string> = {
  JOURNALIER: "Journalier",
  HEBDOMADAIRE: "Hebdomadaire",
  MENSUEL: "Mensuel",
  TRIMESTRIEL: "Trimestriel",
  ANNUEL: "Annuel",
};

/** Export d'un rapport — inclut CSV, contrairement au calendrier des audiences. */
export const FormatRapport = ["JSON", "PDF", "EXCEL", "CSV"] as const;
export type FormatRapport = (typeof FormatRapport)[number];
export const libelleFormatRapport: Record<FormatRapport, string> = {
  JSON: "Écran",
  PDF: "PDF",
  EXCEL: "Excel",
  CSV: "CSV",
};

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
export const libelleRole: Record<Role, string> = {
  ROLE_JURISTE: "Juriste",
  ROLE_DJ: "Directeur Juridique",
  ROLE_DJA: "Directeur Juridique Adjoint",
  ROLE_ASSISTANTE: "Assistante de Direction",
  ROLE_SH: "Supérieur Hiérarchique",
  ROLE_AVOCAT: "Avocat partenaire",
  ROLE_CONSULTATION: "Consultation",
  ROLE_SAISIE: "Saisie",
};

/** Profils métier, à l'exclusion des rôles transverses. Ordre d'affichage hiérarchique. */
export const PROFILS_METIER = [
  "ROLE_DJ",
  "ROLE_DJA",
  "ROLE_SH",
  "ROLE_ASSISTANTE",
  "ROLE_JURISTE",
  "ROLE_AVOCAT",
] as const satisfies readonly Role[];
