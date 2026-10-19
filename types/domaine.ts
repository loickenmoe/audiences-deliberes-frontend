import type {
  CategorieDossier,
  DecisionValidationFrais,
  EtapeValidationFrais,
  EtatDelibere,
  FormatDocument,
  ResultatDelibere,
  CanalAlerte,
  StatutAlarme,
  StatutAlerte,
  StatutExpedition,
  StatutAudience,
  SensCondamnation,
  StatutCircuitFrais,
  StatutConstitution,
  StatutPaiementCondamnation,
  StatutPaiementFrais,
  StatutPublication,
  TypeArchiveJurisprudence,
  SeuilOrigine,
  StatutCycleVie,
  StatutValidation,
  TypeAutrePublication,
  TypeAlerte,
  TriDossiers,
  TypeEtape,
  TypeRapport,
  TypeIntervenant,
  TypePublication,
  TypeValeurConfiguration,
} from "@/types/enums";

/**
 * Backend data shapes, taken from the Java DTOs and checked against `contracts/openapi.json`.
 *
 * Declared by hand rather than using `api.generated.ts` directly: generated types describe HTTP paths
 * and responses, not domain entities, and navigating them would make every signature unreadable.
 * `api.generated.ts` remains the verification reference.
 */

// Reference data

export interface NatureDossier {
  id: number;
  code: string;
  libelle: string;
  categorie: CategorieDossier;
}

/**
 * A bank branch. `id` is the technical id, `code` the one the bank uses and the one a case file
 * carries. Two branches may share a name: the city narrows them down, the address settles it.
 */
export interface Agence {
  id: number;
  code: string;
  nom: string;
  ville: string;
  adresse: string | null;
  telephone: string | null;
  actif: boolean;
}

/** Branch creation and update (DJ/DJA). The code cannot change after creation. */
export interface AgenceEcriture {
  code: string;
  nom: string;
  ville: string;
  adresse?: string | null;
  telephone?: string | null;
  actif?: boolean | null;
}

export interface TypeClientSensible {
  id: number;
  code: string;
  libelle: string;
}

/** `keycloakId` is deliberately not exposed by the backend. */
export interface Utilisateur {
  id: number;
  nom: string | null;
  prenom: string | null;
  email: string | null;
  profil: string;
  actif: boolean;
}

// Clients

export interface Client {
  id: number;
  reference: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreerClient {
  nom: string;
  email?: string;
  telephone?: string;
}

/**
 * `PUT /clients/{id}`: the reference is absent, as it is the client identifier and stays fixed. A
 * cleared optional field is sent as `null`.
 */
export interface ModifierClient {
  nom: string;
  email: string | null;
  telephone: string | null;
}

/**
 * Consolidated client view (US 8.6). Case files are grouped by category and the view is independent
 * of the legal officer's assignment: it shows everything the bank holds against this client.
 */
export interface VueClientDossiers {
  clientId: number;
  clientNom: string;
  recouvrement: Dossier[];
  exploitationLitiges: Dossier[];
}

// Case files

export interface EtapeProcedure {
  id: number;
  dossierId: number;
  type: TypeEtape;
  statutCycleVie: StatutCycleVie;
}

/**
 * The backend `documents` field is always empty: use `GET /dossiers/{id}/documents` instead. It is
 * deliberately not declared here.
 */
export interface Dossier {
  id: number;
  reference: string;
  nature: string;
  categorie: CategorieDossier;
  juridictionSaisie: string;
  clientId: number;
  clientNom: string | null;
  /** Several of each. Never null when read. */
  parties: { demandeurs: string[]; defendeurs: string[] } | null;
  risqueEncouru: number;
  recoursExerces: string | null;
  motifRenvoi: string | null;
  codeAgenceOrigine: string | null;
  codeAgenceContentieuse: string | null;
  dossierCreditOrigine: string | null;
  pvTransfert: string | null;
  incidentCompteReference: string | null;
  elementsJustificatifs: string | null;
  champAlarme: string | null;
  estSensible: boolean | null;
  seuilMontant: number | null;
  typeClientSensible: string | null;
  seuilOrigine: SeuilOrigine | null;
  sensibiliteStatut: StatutValidation | null;
  sensibiliteMotifRejet: string | null;
  /** Reason for removing the special diligence; distinct from a proposal rejection reason. */
  sensibiliteMotifRetrait: string | null;
  etapes: EtapeProcedure[];
  juristesAffectes: number[];
  avocatsAffectes: number[];
  /**
   * Only filled by `GET /dossiers/{id}`, newest first. Lists return it empty: only rely on it on the
   * detail page.
   */
  historique?: HistoriqueAction[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Case file history entry. `action` is a French sentence written by the backend, not a code, so it
 * cannot be translated client-side. `details` is a free object whose shape depends on the action.
 */
export interface HistoriqueAction {
  id: number;
  utilisateurId: number | null;
  /**
   * Typed action kind: the authoritative value, used by filters. `action` is only its readable
   * wording; variable parts (stage name, decision, configuration key) are in `details`.
   */
  code: string;
  action: string;
  details: Record<string, unknown> | null;
  dateAction: string;
}

/**
 * An audit page: a regular page plus `actionsDisponibles`, the action kinds actually present, which
 * feed a closed-list filter. That list ignores current filters, so picking one does not hide the
 * others.
 *
 * The audit only covers changes (RG-DOS-06). No read access is logged except for this screen: a
 * missing row does not prove no action happened.
 */
export interface PageAudit {
  content: HistoriqueAction[];
  totalPages: number;
  totalElements: number;
  actionsDisponibles: OptionActionAudit[];
}

/**
 * An entry of the action kind filter: the code is sent to the server, the label is displayed. The
 * label is derived from the backend enum rather than read from the row, since migrated rows still
 * carry their old wording.
 */
export interface OptionActionAudit {
  code: string;
  libelle: string;
}

/**
 * A produced and sealed audit archive.
 *
 * `empreinte` is the SHA-256 of the stored file: it proves later that a file is the sealed one, not
 * a copy. The storage key is not exposed: it would only bypass the download endpoint, the only place
 * where retrieval is logged.
 */
export interface ArchiveAudit {
  id: number;
  /**
   * Readable reference, e.g. `AUD-2026-0042`. It designates the archive while the fingerprint proves
   * it, and it is the only identifier the file itself can carry without changing its bytes.
   */
  reference: string;
  utilisateurId: number | null;
  dateExport: string;
  dateDebut: string;
  dateFin: string;
  perimetre: string;
  format: "PDF" | "EXCEL";
  lignes: number;
  empreinte: string;
  tailleOctets: number;
}

/** Fingerprint check result. `reconnue` false is not an error: the document matches no archive. */
export interface VerificationArchive {
  reconnue: boolean;
  archive: ArchiveAudit | null;
}

/** Threshold waiver request and its decision. */
export interface AuditSeuil {
  id: number;
  dossierId: number;
  utilisateurId: number | null;
  ancienSeuil: number | null;
  nouveauSeuil: number;
  motif: string | null;
  validePar: number | null;
  statut: StatutValidation;
  dateAction: string;
}

/** `PUT /dossiers/{id}/affectation` replaces both lists; it does not append. */
export interface ModifierAffectation {
  juristesAffectes: number[];
  avocatsAffectes: number[];
}

export interface DemandeDerogation {
  nouveauSeuil: number;
  motif: string;
}

export interface ValiderDerogation {
  statut: Exclude<StatutValidation, "EN_ATTENTE">;
  /** Required on rejection. */
  motif?: string;
}

/**
 * Sensitivity validation by the DJ/DJA. Threshold and type may be adjusted when validating;
 * `typeClientSensibleAjuste` is a code checked against the reference data.
 */
export interface ValiderSensibilite {
  statut: Exclude<StatutValidation, "EN_ATTENTE">;
  motifRejet?: string;
  seuilMontantAjuste?: number;
  typeClientSensibleAjuste?: string;
}

/**
 * Special diligence proposal on an already open case file. Threshold and type are required as at
 * creation; the `motif` explains what changed since the file lived without it.
 */
export interface ProposerDiligence {
  seuilMontant: number;
  typeClientSensible: string;
  motif: string;
}

/**
 * Direct setting or removal by the DJ or the DJA, without proposal. `estSensible` true requires
 * threshold and type; false is a removal and requires a `motif` (the file leaves the double fee
 * validation workflow).
 */
export interface ModifierDiligence {
  estSensible: boolean;
  seuilMontant?: number;
  typeClientSensible?: string;
  motif?: string;
}

/** Deletion request created when an authoring legal officer deletes a document (202 response). */
export type StatutSuppression = "EN_ATTENTE" | "APPROUVEE" | "REJETEE";

/**
 * Deletion request. Names its target (file, type, case file) even once the document is deleted.
 */
export interface DemandeSuppression {
  id: number;
  documentId: number;
  documentNom: string;
  typeDocument: string | null;
  dossierId: number;
  referenceDossier: string;
  demandeurId: number | null;
  motif: string | null;
  statut: StatutSuppression;
  valideParId: number | null;
  motifRejet: string | null;
  dateDemande: string;
  dateDecision: string | null;
  /** Automatic reminder to the DJ/DJA every 72 h while the request is pending. */
  dateDerniereRelance: string | null;
}

/** Daily DMS report: zeros and an empty list on a day without activity, never an error. */
export interface RapportJournalier {
  date: string;
  dossiersManipules: number;
  piecesAjoutees: number;
  affairesNouvelles: number;
  planificationActes: { dossierId: number; reference: string; datePlanifiee: string }[];
}

/** Deletion outcome: immediate (DJ/DJA, 200) or pending decision (legal officer, 202). */
export type ResultatSuppression =
  | { immediate: true; document: DocumentDossier }
  | { immediate: false; demande: DemandeSuppression };

/**
 * Sharing state of a document with the case file's lawyer. `PROPOSE`: proposed on a sensitive case
 * file; nothing is visible until the DJ or the DJA decides.
 */
export type StatutPartageAvocat = "NON" | "PROPOSE" | "PARTAGE";

/** A document in the DJ/DJA queue of shares to approve. */
export interface PartageAvocat {
  documentId: number;
  dossierId: number;
  referenceDossier: string;
  nomFichier: string;
  typeDocument: string | null;
  partageAvocat: StatutPartageAvocat;
  partageParNom: string | null;
  partageLe: string | null;
}

/** Document attached to a case file. */
export interface DocumentDossier {
  id: number;
  dossierId: number;
  nomFichier: string;
  typeDocument: string | null;
  format: FormatDocument;
  poids: number;
  auteurChargementId: number | null;
  dateChargement: string;
  estSupprime: boolean;
  urlTelechargement: string | null;
  /** Shared with the case file's lawyer, proposed, or restricted to internal profiles. */
  partageAvocat: StatutPartageAvocat;
}

/**
 * Case file creation (FR-DOS-01). Contract pitfalls (see backend `DossierService`):
 * - `nature` is the reference data label, not its code or id (resolved by `findByLibelleIgnoreCase`);
 * - `categorie` is derived from the nature (RG-DOS-02); sending a diverging one causes a 400, so the
 *   form derives it client-side without sending it;
 * - `typeClientSensible` expects the code (`VIP`, `ENTREPRISE`, `PARTICULIER`), not the label.
 */
/** No reference: the server assigns it. */
export interface CreerDossier {
  nature: string;
  juridictionSaisie: string;
  clientId: number;
  /** Required at creation: at least one claimant and one defendant. */
  parties: { demandeurs: string[]; defendeurs: string[] };
  risqueEncouru: number;
  recoursExerces?: string;
  motifRenvoi?: string;
  codeAgenceOrigine?: string;
  codeAgenceContentieuse?: string;
  /** Both required for a `RECOUVREMENT` case file. */
  dossierCreditOrigine?: string;
  pvTransfert?: string;
  /** Both required for an `EXPLOITATION_LITIGES` case file. */
  incidentCompteReference?: string;
  elementsJustificatifs?: string;
  champAlarme?: string;
  /** `seuilMontant` and `typeClientSensible` become required when this is true. */
  estSensible?: boolean;
  seuilMontant?: number;
  typeClientSensible?: string;
  /** Both non-empty: a case file without a legal officer or a lawyer is rejected. */
  juristesAffectes: number[];
  avocatsAffectes: number[];
}

/** `GET /dossiers` filters. `mesDossiers` resolves to the authenticated user. */
export interface FiltresDossiers {
  nature?: string;
  categorie?: CategorieDossier;
  juridiction?: string;
  reference?: string;
  clientId?: number;
  mesDossiers?: boolean;
  /** `false` filters non-sensitive case files; `undefined` does not filter. */
  estSensible?: boolean;
  /** `EN_ATTENTE` is the DJ/DJA queue of sensitivities to validate. */
  sensibiliteStatut?: StatutValidation;
  /** Both stage criteria apply to the same stage (e.g. "an appeal in progress"). */
  typeEtape?: TypeEtape;
  statutEtape?: StatutCycleVie;
  /** The period applies to hearings: case files that had a hearing in that range. */
  dateDebut?: string;
  dateFin?: string;
  tri?: TriDossiers;
  page?: number;
  size?: number;
}

// Hearings and alarms

/** Stage hearing. `datePlanifiee` and `dateTenue` are date-only values. */
export interface Audience {
  id: number;
  dossierId: number;
  etapeId: number;
  datePlanifiee: string;
  /** Set by the backend to the hearing's planned date, whatever the entry date. */
  dateTenue: string | null;
  /**
   * Where the hearing takes place, distinct from the case file's `juridictionSaisie` (an appeal is not
   * heard by the court that ruled). Inherited from the case file when scheduling unless specified.
   */
  juridiction: string | null;
  compteRendu: string | null;
  statut: StatutAudience;
  createdAt: string;
  /** Set on cancellation: reason required, timestamp without time zone. */
  motifAnnulation: string | null;
  dateAnnulation: string | null;
  /**
   * Note from the legal officer to the appointed lawyer. Distinct from the hearing report, which stays
   * internal as it may assess strategy or the lawyer's own work (RG-INT-07).
   */
  noteAvocat: string | null;
}

/**
 * Stage alarm. `dateEcheance` is a timestamp without time zone. Rescheduling closes the alarm
 * (`TRAITEE`) and creates a new one referencing it in `alarmePrecedenteId`: a chain, not an update.
 */
export interface Alarme {
  id: number;
  dossierId: number;
  etapeId: number;
  objet: string;
  dateEcheance: string;
  statut: StatutAlarme;
  dateTraitement: string | null;
  alarmePrecedenteId: number | null;
  createdBy: number | null;
  createdAt: string;
}

/** Calendar row. Assignments are ids, resolved to names on display. */
export interface EntreeCalendrier {
  audienceId: number;
  dossierId: number;
  referenceDossier: string;
  juridiction: string;
  etape: string;
  juristesAffectes: number[];
  avocatsAffectes: number[];
  codeAgenceOrigine: string | null;
  clientNom: string | null;
  risqueEncouru: number | null;
  datePlanifiee: string;
}

export interface PlanifierAudience {
  etapeId: number;
  /** `YYYY-MM-DD`, not earlier than the case file opening (RG-AUD-08). */
  datePlanifiee: string;
  /** Optional: when empty, the case file's court is used (first-instance case). */
  juridiction?: string;
}

export interface CreerAlarme {
  etapeId: number;
  objet: string;
  /** `YYYY-MM-DDTHH:mm`, strictly in the future. */
  dateEcheance: string;
}

export interface ReprogrammerAlarme {
  /** Optional: when empty, the previous alarm's subject is reused. */
  objet?: string;
  dateEcheance: string;
}

// Deliberations

/**
 * Deliberation. Created when the case is reserved for judgment, without a result: `dateDeliberee`
 * is then the announced date, replaced by each extension. `resultat` and `statutExpedition` are set
 * only once the decision is delivered (`etat` = `VIDE`).
 */
export interface Delibere {
  id: number;
  dossierId: number;
  etapeId: number;
  dateDeliberee: string;
  etat: EtatDelibere;
  resultat: ResultatDelibere | null;
  statutExpedition: StatutExpedition | null;
  /** Timestamp without time zone; only for an unfavourable or mixed result. */
  dateEcheanceRecours: string | null;
  nombreProrogations: number;
  dateRabattement: string | null;
  motifRabattement: string | null;
  createdAt: string;
}

/** Extension. `alerte`: beyond the threshold, a warning rather than an error. */
export interface Prorogation {
  id: number;
  delibereId: number;
  date: string;
  motif: string | null;
  compteur: number;
  alerte: boolean;
  createdAt: string;
}

/** Appeal deadline tracking, read-only. */
export interface Recours {
  delibereId: number;
  dateEcheanceRecours: string | null;
  recoursExerce: boolean;
  delaiExpire: boolean;
  cloture: boolean;
}

/** Without `resultat`: reserved for judgment; with it: an already delivered decision. */
export interface EnregistrerDelibere {
  etapeId: number;
  dateDeliberee: string;
  resultat?: ResultatDelibere;
  dateEcheanceRecours?: string;
}

/** The decision is delivered. A deadline is required for an unfavourable or mixed result. */
export interface ViderDelibere {
  resultat: ResultatDelibere;
  dateEcheanceRecours?: string;
}

export interface ProrogerDelibere {
  /** `YYYY-MM-DD`, strictly in the future (US 3.2). */
  date: string;
  motif?: string;
}

export interface RabattreDelibere {
  date: string;
  motif: string;
}

// External parties

export interface Intervenant {
  id: number;
  type: TypeIntervenant;
  nom: string;
  email: string | null;
  telephone: string | null;
  compteKeycloak: string | null;
  notification: boolean | null;
  createdAt: string;
}

/**
 * Backend invariants (RG-INT-01/02):
 * - an `AVOCAT` requires a unique `compteKeycloak` (400 if missing, 409 if taken);
 * - an `AUTRE_PRESTATAIRE` cannot have an application account.
 *
 * `notification` is the provider's consent to external channels (SMS, WhatsApp, personal email).
 * When absent it defaults to `true` for a lawyer and `false` for another provider.
 */
export interface CreerIntervenant {
  type: TypeIntervenant;
  nom: string;
  email?: string;
  telephone?: string;
  compteKeycloak?: string;
  notification?: boolean;
}

/**
 * `PUT /intervenants/{id}`: type and login are fixed (identity is managed in Keycloak). Consent to
 * external notifications can be changed for both types.
 */
export interface ModifierIntervenant {
  nom: string;
  email: string | null;
  telephone: string | null;
  notification: boolean | null;
}

// Lawyer fees

/** A workflow decision: who, at which step, what, why, when. */
export interface ValidationFrais {
  etape: EtapeValidationFrais;
  decision: DecisionValidationFrais;
  motif: string | null;
  utilisateurId: number | null;
  utilisateurNom: string | null;
  dateValidation: string | null;
}

/**
 * Fee request, readable without further calls: case file and lawyer named, workflow decisions in
 * order. `validationConjointeRequise` applies RG-INT-03 (sensitive case file or amount above
 * `seuilApplicable`).
 *
 * `piecesJustificatives` is the raw list and may contain legacy labels designating no file.
 * `piecesTelechargeables` only holds actually stored documents, with original name and a short-lived
 * signed URL, filled on the detail only. The screen should prefer the latter: compliance checks
 * concern the documents, not their names.
 */
/** A stored supporting document, as returned by the fee request detail. */
export interface PieceTelechargeable {
  /** Storage path; a stable key, never shown to the user. */
  cle: string;
  nomFichier: string;
  /** Short-lived signed URL: use immediately, do not keep. */
  urlTelechargement: string;
}

export interface DemandeFrais {
  id: number;
  dossierId: number;
  referenceDossier: string;
  avocatId: number;
  avocatNom: string;
  montant: number;
  piecesJustificatives: string[];
  /** Empty on the list; filled on the detail, for actually stored documents. */
  piecesTelechargeables: PieceTelechargeable[];
  statutCircuit: StatutCircuitFrais;
  motifRejet: string | null;
  statutPaiement: StatutPaiementFrais;
  referenceFacture: string;
  dossierSensible: boolean | null;
  seuilApplicable: number;
  validationConjointeRequise: boolean;
  validations: ValidationFrais[];
  createdAt: string;
  updatedAt: string | null;
}

// Publications

/** Legal officer comment: for the DJ and the DJA, never for the lawyer (RG-INT-07). */
export interface CommentairePublication {
  id: number;
  publicationId: number;
  auteurId: number | null;
  auteurNom: string | null;
  contenu: string;
  createdAt: string;
}

/** Single correspondence from the DJ/DJA to the lawyer. */
export interface CorrespondanceAvocat {
  id: number;
  publicationId: number;
  auteurId: number | null;
  auteurNom: string | null;
  contenu: string;
  createdAt: string;
}

/**
 * Lawyer publication: hearing report (`contenu`, `audienceDate`) or other publication
 * (`typeDocument`, `nomFichier`). `urlTelechargement` (10 minutes) and `commentaires` only exist on
 * the detail.
 *
 * `correspondance` is also returned by `GET /portail/mes-publications`, the only screen where the
 * lawyer reads what the DJ/DJA sent. `commentaires` is always null for the lawyer: the discussion
 * between legal officer and DJ/DJA is never addressed to them (US 5.5, RG-INT-07).
 */
export interface Publication {
  id: number;
  type: TypePublication;
  dossierId: number;
  avocatId: number;
  dateDepot: string;
  statutValidation: StatutPublication;
  motifRejet: string | null;
  restrictionAccesId: number | null;
  audienceId: number | null;
  contenu: string | null;
  typeDocument: TypeAutrePublication | null;
  referenceDossier: string;
  avocatNom: string;
  audienceDate: string | null;
  restrictionAccesNom: string | null;
  nomFichier: string | null;
  urlTelechargement: string | null;
  commentaires: CommentairePublication[] | null;
  correspondance: CorrespondanceAvocat | null;
}

// Engagements and directory

/** Provider engagement request. */
/**
 * Content of an engagement letter, read by two roles: `modifiable` tells which use remains open
 * rather than letting the screen infer it from a status.
 *
 * `numero` is null while the letter is a draft: it is assigned on signature so that no number is
 * burnt on an abandoned request (the series never restarts, gaps would remain).
 */
export interface LettreConstitution {
  id: number;
  demandeId: number;
  numero: number | null;
  numeroPropose: number | null;
  /** `First Bank/DAJR/DR/CM/ABN/18`: the screen splits it on "/", the server stores it as one string. */
  suffixeNumero: string;
  lieu: string;
  destinataireNom: string | null;
  destinataireQualite: string | null;
  destinataireVille: string | null;
  concerne: string | null;
  objet: string;
  corps: string;
  signataire: string;
  /** False once the letter is signed: a document filed in the case file is never altered. */
  modifiable: boolean;
  dateGeneration: string | null;
  dateModification: string | null;
  /**
   * Who wrote the latest version. The SH may correct before signing, so traceability shows the
   * requester that the letter changed and by whom. Null until someone writes (the draft is created
   * with the request).
   */
  redigeParNom: string | null;
  /** Writer's profile code (`JURISTE`, `SH`), so the screen names it itself. */
  redigeParProfil: string | null;
}

/**
 * State of my stored signature. Does not carry the image: the screen only needs to know whether to
 * offer an upload or a replacement; the image has its own call.
 */
export interface Signature {
  deposee: boolean;
  type: string | null;
  deposeeLe: string | null;
}

export interface DemandeConstitution {
  id: number;
  dossierId: number;
  prestataireId: number;
  demandeurId: number;
  motif: string;
  statut: StatutConstitution;
  valideParId: number | null;
  motifRejet: string | null;
  /** Letter generated on SH signature, filed in the case file's DMS. */
  lettreDocumentId: number | null;
  dateDemande: string;
  dateDecision: string | null;
  referenceDossier: string;
  prestataireNom: string;
  prestataireType: TypeIntervenant;
  demandeurNom: string | null;
  valideParNom: string | null;
  /**
   * True if the current reader may edit the letter: its requester, or the SH. Computed by the server,
   * never inferred here: the screen does not know the requester's internal id, and the composite
   * `ROLE_JURISTE` would wrongly grant the DJ and the DJA.
   */
  redactionPossible: boolean;
}

/**
 * Explanation request sent by management to a lawyer, and its answer.
 *
 * `enAttente` is computed by the server from the answer date, never stored. `dossierId` is optional:
 * the request concerns conduct (e.g. missed hearings across several case files), not a single case.
 */
export interface DemandeExplication {
  id: number;
  avocatId: number;
  avocatNom: string;
  dossierId: number | null;
  referenceDossier: string | null;
  auteurNom: string | null;
  contenu: string;
  dateDemande: string;
  reponse: string | null;
  dateReponse: string | null;
  enAttente: boolean;
}

/**
 * A person's activity over a period.
 *
 * `delaiMoyenSaisieCompteRendu` is null when no report was entered: zero would read as same-day
 * entry. `fraisTraites` adds both checks (compliance and appropriateness), two distinct actions on
 * the same request.
 */
export interface ActiviteNominative {
  utilisateurId: number;
  nom: string | null;
  profil: string | null;
  dossiersOuverts: number;
  audiencesPlanifiees: number;
  comptesRendusSaisis: number;
  deliberesEnregistres: number;
  lettresRedigees: number;
  fraisTraites: number;
  delaiMoyenSaisieCompteRendu: number | null;
}

/**
 * An action kind and its count in a person's activity sheet. `code` is a `TypeActionHistorique`
 * value; its label is read from `historique.actions`, since the server only has a French label.
 */
export interface LigneActivite {
  code: string;
  total: number;
}

/**
 * A person's activity sheet over a period. Unlike [[RapportNominatif]], which compares people on six
 * fixed columns, this sheet faithfully reflects what one person did. Only action kinds actually
 * performed appear in `lignes`.
 */
export interface RapportActivite {
  utilisateurId: number;
  nom: string | null;
  profil: string | null;
  dateDebut: string;
  dateFin: string;
  lignes: LigneActivite[];
  delaiMoyenSaisieCompteRendu: number | null;
}

/**
 * An action behind an activity sheet count, making the count clickable. `dossierId` is null for an
 * action outside any case file (configuration change, reference data fix); the row is still shown,
 * without a link, so the count matches the number of rows.
 */
export interface ActionDetaillee {
  id: number;
  code: string;
  action: string;
  dateAction: string;
  dossierId: number | null;
  referenceDossier: string | null;
}

/** Dashboard blocks that can be drilled into: one per displayed block. */
export type IndicateurTableauDeBord =
  | "DOSSIERS_ACTIFS"
  | "AFFAIRES_VIDEES"
  | "AUDIENCES_PLANIFIEES"
  | "FRAIS_EN_ATTENTE"
  | "PROROGATIONS_ALERTE"
  | "LITIGES_GAGNES"
  | "LITIGES_PERDUS"
  | "DECISIONS_MIXTES"
  | "PROVISIONS_REPRISES";

/**
 * A row behind a dashboard block. A single shape for all nine indicators, although the counted
 * objects differ; the originating block already says what is being viewed.
 *
 * `dossierId` is null for an object not tied to a case file; the row is still shown without a link,
 * so the row count matches the displayed figure.
 */
export interface DetailIndicateur {
  id: number;
  dossierId: number | null;
  referenceDossier: string | null;
  intitule: string | null;
  precision: string | null;
  date: string | null;
  montant: number | null;
}

/**
 * A lawyer and their filings over the period. `avocatId` is null if their directory entry was
 * removed since: their filings still count, and the screen opens their sheet by account instead.
 */
export interface ActiviteAvocat {
  utilisateurId: number;
  avocatId: number | null;
  nom: string | null;
  comptesRendusDeposes: number;
  demandesFraisDeposees: number;
  autresPublicationsDeposees: number;
  explicationsFournies: number;
}

/**
 * Lawyers' activity over a period, counterpart of [[RapportNominatif]]. Lawyers file while legal
 * officers record, so they get their own indicators. Same rule: no score, no ranking by volume;
 * rows follow name order.
 */
export interface RapportAvocats {
  dateDebut: string;
  dateFin: string;
  lignes: ActiviteAvocat[];
}

/**
 * Activity report per person. Indicators, not a score: no ranking and no grand total; rows follow
 * name order so the report does not read as a league table.
 */
export interface RapportNominatif {
  dateDebut: string;
  dateFin: string;
  lignes: ActiviteNominative[];
}

/**
 * Directory lawyer, sorted by increasing workload.
 *
 * `indicateurCharge`: active case files. `deliberesFavorables` / `deliberesTotal`: displayed as
 * "3 out of 4", which shows the sample size a percentage hides. `indicateurPerformance` remains in
 * the contract but is no longer displayed.
 */
export interface AvocatRepertoire {
  id: number;
  nom: string;
  email: string | null;
  telephone: string | null;
  indicateurCharge: number;
  deliberesFavorables: number;
  deliberesTotal: number;
  indicateurPerformance: number;
}

// Final decisions and case law

/** Adjudication: final decision in the Bank's favour, on a closed stage (RG-DEF-01/02). */
export interface Adjudication {
  id: number;
  dossierId: number;
  etapeId: number;
  beneficiaire: string;
  statutComptabilisation: string | null;
  repriseProvision: boolean;
  restitutionSoulte: boolean;
  mutation: boolean;
  reliquat: number;
  dateDecision: string;
  createdAt: string;
  updatedAt: string | null;
}

/** Monetary judgment: only its payment status changes (RG-DEF-03/04). */
export interface Condamnation {
  id: number;
  dossierId: number;
  etapeId: number | null;
  sens: SensCondamnation;
  naturePaiement: string;
  statutPaiement: StatutPaiementCondamnation;
  dateDecision: string;
  createdAt: string;
  updatedAt: string | null;
}

/** A case file's decisions, each list newest first. */
export interface DecisionsDossier {
  adjudications: Adjudication[];
  condamnations: Condamnation[];
}

export interface CreerAdjudication {
  /** Case file stage must be `CLOTURE` (400 otherwise, RG-DEF-01). */
  etapeId: number;
  beneficiaire: string;
  statutComptabilisation: string;
  repriseProvision: boolean;
  restitutionSoulte: boolean;
  mutation: boolean;
  /** >= 0 (400 otherwise). */
  reliquat: number;
  dateDecision: string;
}

/** No stage precondition; payment status always starts as `EN_ATTENTE`. */
export interface CreerCondamnation {
  etapeId?: number;
  sens: SensCondamnation;
  naturePaiement: string;
  dateDecision: string;
}

/** Case law; `urlTelechargement` is pre-signed and valid for 10 minutes. */
export interface Jurisprudence {
  id: number;
  dossierId: number | null;
  typeArchive: TypeArchiveJurisprudence;
  motsCles: string[];
  natureDecision: string;
  juridiction: string;
  dateDecision: string;
  urlTelechargement: string | null;
  createdAt: string;
}

/** Indexing required (RG-DEF-05); PDF file of at most 10 MB; case file optional. */
export interface ArchiverJurisprudence {
  dossierId?: number;
  typeArchive: TypeArchiveJurisprudence;
  motsCles: string[];
  natureDecision: string;
  juridiction: string;
  dateDecision: string;
}

// Alerts and configuration

/**
 * Notification for a user. The backend stores it before attempting real-time delivery: an alert is
 * never lost, only the push may be missed.
 *
 * `declencheur` is the business text, sometimes prefixed with a technical de-duplication marker such
 * as `[delibereId:12] `, stripped on display (`lib/alertes.ts`).
 */
export interface Alerte {
  id: number;
  dossierId: number | null;
  destinataireId: number;
  type: TypeAlerte;
  declencheur: string;
  canal: CanalAlerte;
  statut: StatutAlerte;
  dateDeclenchement: string;
  dateTraitement: string | null;
}

/**
 * System setting. The last four fields describe the key's input rule: the admin form follows it
 * instead of redeclaring bounds, and the backend rejects out-of-rule values anyway.
 */
export interface ConfigurationSysteme {
  cle: string;
  valeur: string;
  description: string | null;
  modifiablePar: string;
  dateModification: string | null;
  /**
   * Author of the last change. Null if the setting was never changed or the author's account was
   * deleted since.
   */
  dernierAuteurId: number | null;
  typeValeur: TypeValeurConfiguration | null;
  valeurMinimale: number | null;
  valeurMaximale: number | null;
  valeursPossibles: string[];
  /**
   * A list may be fully unchecked (notification settings, where "no channel" or "no event" is a
   * deliberate choice).
   */
  listeVideAutorisee: boolean;
}

/** A row of the external notification supervision table. */
/**
 * A hearing on a given day with what was reported. The legal officer's report and the lawyer's
 * validated report are shown side by side; the gap shows what remains to be done.
 */
export interface AudienceDuJour {
  audienceId: number;
  dossierId: number;
  referenceDossier: string;
  juridiction: string | null;
  etape: TypeEtape | null;
  statut: StatutAudience;
  /** Ids of the legal officers assigned to the case file; the screen names them. */
  juristesAffectes: number[];
  compteRenduJuriste: string | null;
  compteRenduAvocat: string | null;
  avocatDuCompteRendu: number | null;
  /**
   * Signed URL of the document attached to the lawyer's report (court record, hearing note), or
   * `null` if none. The legal officer's report is text only.
   */
  urlPieceJointeAvocat: string | null;
}

/**
 * A past hearing whose legal officer report is still missing. "Held" is only set when the report is
 * entered, so a past hearing still "planned" is exactly a hearing without a report.
 */
export interface CompteRenduAttendu {
  audienceId: number;
  dossierId: number;
  referenceDossier: string;
  juridiction: string | null;
  etape: TypeEtape | null;
  datePlanifiee: string;
  joursDeRetard: number;
  juristesAffectes: number[];
  /** The lawyer has reported: the bank side still has to record it. */
  compteRenduAvocatDepose: boolean;
}

export interface LigneCanalNotification {
  canal: string;
  /** Queued, not yet handed to the engine. */
  enAttente: number;
  /** Handed to the engine, no confirmation received yet. */
  remises: number;
  /** Confirmed by an engine acknowledgement. */
  confirmees: number;
  /** Abandoned: attempts exhausted, expired, or final engine failure. */
  echecs: number;
  /** Handed over but without any acknowledgement past the deadline. */
  sansRetour: number;
  /** Channel selected for a recipient without usable contact details. */
  nonJoignables: number;
}

/** A send to review: abandoned, no feedback, or unreachable recipient. */
export interface EnvoiNotificationEnDefaut {
  id: number;
  eventId: string;
  typeEvenement: string;
  canal: string;
  statut: string;
  destinataire: string | null;
  /** Actual recipient when the non-production redirection replaced it. */
  destinataireOrigine: string | null;
  derniereErreur: string | null;
  tentatives: number;
  dateCreation: string | null;
}

export interface SupervisionNotifications {
  dateDebut: string;
  dateFin: string;
  canaux: LigneCanalNotification[];
  derniersEchecs: EnvoiNotificationEnDefaut[];
  /** Backend switch: when false, nothing is sent and everything is still logged. */
  engineActif: boolean;
  /**
   * Does the engine publish acknowledgements? If not, "handed over" is the last known state of a
   * successful send, and the confirmations column stays empty without flagging anything.
   */
  suiviAccusesActif: boolean;
}

/**
 * Supervision of the in-app channel over a window (NF-ALR-02).
 *
 * Two distinct rates. `tauxDelivrance` answers NF-ALR-02 (did the channel do its job?): only failures
 * count, since an alert delivered later to an offline recipient is still delivered through the
 * notification list. `tauxDiffusionTempsReel` measures how often people are online when alerted; a
 * low value there is not a defect.
 *
 * `observees` is the real denominator (alerts older than migration V16 have no recorded outcome).
 * `nonTraitees` is not part of any rate.
 */
export interface StatistiquesDiffusion {
  dateDebut: string;
  dateFin: string;
  observees: number;
  diffusees: number;
  differees: number;
  echecs: number;
  nonTraitees: number;
  tauxDelivrance: number;
  tauxDiffusionTempsReel: number;
  seuilRespecte: boolean;
}

// Reporting

/**
 * Executive dashboard. Nine real-time indicators across all case files, not restricted to a period
 * or to the caller's portfolio.
 *
 * `tauxSuccesRecouvrement` is a 0-1 ratio, no longer displayed but still returned (used by the
 * periodic report). Won, lost and mixed are three distinct counts: "lost" is not "total minus won",
 * since a mixed deliberation is neither.
 */
export interface TableauDeBord {
  nbDossiersActifs: number;
  nbAudiencesPlanifiees: number;
  nbDemandesFraisEnAttente: number;
  nbProrogationsAlerte: number;
  tauxSuccesRecouvrement: number;
  nbLitigesGagnes: number;
  nbLitigesPerdus: number;
  nbLitigesMixtes: number;
  /**
   * Closed cases: case files with no stage in progress. Exact complement of `nbDossiersActifs`; both
   * add up to the case files with at least one stage.
   */
  nbAffairesVidees: number;
  provisionsReprises: number;
}

/**
 * Activity report over a period. `type` is only a label; `dateDebut` and `dateFin` bound the
 * computation. The backend returns 204 when all four counters are zero: an empty state, returned as
 * `null` by the service.
 */
export interface Rapport {
  type: TypeRapport;
  dateDebut: string;
  dateFin: string;
  nbNouveauxDossiers: number;
  nbAudiencesTenues: number;
  nbDemandesFraisDeposees: number;
  nbDeliberesEnregistres: number;
  /**
   * Still returned by the API but no longer displayed or exported: the three counts below convey it
   * without computation.
   */
  tauxSuccesRecouvrement: number;
  nbLitigesGagnes: number;
  nbLitigesPerdus: number;
  nbLitigesMixtes: number;
  provisionsReprises: number;
}

// Lawyer portal

/**
 * Fee request filed by the lawyer (US 4.1). `piecesJustificatives` holds the storage paths returned
 * by `portailAvocatService.deposerPieceJustificative`: files are uploaded first, in two steps.
 */
export interface DeposerFrais {
  dossierId: number;
  /** > 0 (400 otherwise). */
  montant: number;
  /** At least one document (400 otherwise): keys returned by the upload. */
  piecesJustificatives: string[];
  /** Unique: a duplicate returns 409 `ERR-006` on this field. */
  referenceFacture: string;
}

/**
 * Hearing report filed by the lawyer (US 5.1). The hearing must belong to the case file, otherwise
 * the backend returns 404. The narrative is required; the supporting document is optional and sent
 * separately as multipart.
 */
export interface DeposerCompteRendu {
  dossierId: number;
  audienceId: number;
  contenu: string;
  /** Id of the only authorized reader; when omitted, the publication follows the usual permissions. */
  restrictionAcces?: number;
}
