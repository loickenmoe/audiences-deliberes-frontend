import type {
  CategorieDossier,
  DecisionValidationFrais,
  EtapeValidationFrais,
  EtatDelibere,
  FormatDocument,
  ResultatDelibere,
  StatutAlarme,
  StatutExpedition,
  StatutAudience,
  StatutCircuitFrais,
  StatutConstitution,
  StatutPaiementFrais,
  StatutPublication,
  SeuilOrigine,
  StatutCycleVie,
  StatutValidation,
  TypeAutrePublication,
  TypeEtape,
  TypeIntervenant,
  TypePublication,
} from "@/types/enums";

/**
 * Formes de données du backend, relevées dans les DTO Java (paquets `web.dto` du backend) et recoupées avec
 * `contracts/openapi.json`.
 *
 * On les déclare à la main plutôt que d'utiliser directement `api.generated.ts` : les types générés
 * décrivent des chemins et des réponses HTTP, pas des entités du domaine, et leur navigation
 * (`paths["/api/v1/clients"]["get"]["responses"][200]…`) rendrait chaque signature illisible.
 * `api.generated.ts` reste la référence de vérification, ces alias sont l'usage courant.
 */

// ─────────────────────────────── Référentiels ───────────────────────────────

export interface NatureDossier {
  id: number;
  code: string;
  libelle: string;
  categorie: CategorieDossier;
}

export interface TypeClientSensible {
  id: number;
  code: string;
  libelle: string;
}

/** `keycloakId` n'est délibérément pas exposé par le backend (#66). */
export interface Utilisateur {
  id: number;
  nom: string | null;
  prenom: string | null;
  email: string | null;
  profil: string;
  actif: boolean;
}

// ─────────────────────────────── Clients ───────────────────────────────

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
  reference: string;
  nom: string;
  email?: string;
  telephone?: string;
}

/**
 * Vue consolidée d'un client (#11, US 8.6). Les dossiers sont **regroupés par catégorie** et la vue
 * est **indépendante de l'affectation du juriste** : elle montre tout ce que la banque porte contre
 * ce client, pas seulement ce que l'utilisateur suit.
 */
export interface VueClientDossiers {
  clientId: number;
  clientNom: string;
  recouvrement: Dossier[];
  exploitationLitiges: Dossier[];
}

// ─────────────────────────────── Dossiers ───────────────────────────────

export interface EtapeProcedure {
  id: number;
  dossierId: number;
  type: TypeEtape;
  statutCycleVie: StatutCycleVie;
}

/**
 * ⚠ `documents` est **vide par construction** (Q-67 backend) : ne jamais le consommer, passer par
 * `GET /dossiers/{id}/documents`. Il n'est pas déclaré ici, pour qu'on ne puisse pas s'y tromper.
 */
export interface Dossier {
  id: number;
  reference: string;
  nature: string;
  categorie: CategorieDossier;
  juridictionSaisie: string;
  clientId: number;
  clientNom: string | null;
  parties: { demandeur: string | null; defendeur: string | null } | null;
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
  etapes: EtapeProcedure[];
  juristesAffectes: number[];
  avocatsAffectes: number[];
  /**
   * Renseigné par `GET /dossiers/{id}` seulement, du plus récent au plus ancien. Les listes le
   * renvoient vide : ne jamais s'y fier ailleurs que sur la fiche.
   */
  historique?: HistoriqueAction[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Entrée de l'historique d'un dossier.
 *
 * ⚠ `action` est une **phrase en français rédigée par le backend** (« Changement de statut de
 * l'étape INSTANCE »), pas un code : elle ne peut pas être traduite côté client. Signalé à
 * l'utilisateur (QF-24). `details` est un objet libre dont la forme dépend de l'action.
 */
export interface HistoriqueAction {
  id: number;
  utilisateurId: number | null;
  action: string;
  details: Record<string, unknown> | null;
  dateAction: string;
}

/** Demande de dérogation de seuil et son arbitrage (#6, #7). */
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

/** `PUT /dossiers/{id}/affectation` **remplace** les deux listes : il n'ajoute pas. */
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
  /** Obligatoire en cas de rejet. */
  motif?: string;
}

/**
 * Validation de la sensibilité par le DJ/DJA (#8). Le seuil et le type peuvent être **ajustés** au
 * moment de valider ; `typeClientSensibleAjuste` est un code, validé contre le référentiel (Q-73).
 */
export interface ValiderSensibilite {
  statut: Exclude<StatutValidation, "EN_ATTENTE">;
  motifRejet?: string;
  seuilMontantAjuste?: number;
  typeClientSensibleAjuste?: string;
}

/** Demande de suppression créée quand un juriste auteur supprime une pièce (#40, réponse 202). */
export type StatutSuppression = "EN_ATTENTE" | "APPROUVEE" | "REJETEE";

/**
 * Demande de suppression (#40 en 202, #41, #63). Depuis Q-79, elle nomme ce qu'elle vise — fichier,
 * type, dossier — y compris quand le document a déjà été supprimé.
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
  /** Relance automatique aux DJ/DJA toutes les 72 h tant que la demande attend. */
  dateDerniereRelance: string | null;
}

/** Rapport journalier GED (#42) : zéros et liste vide un jour sans activité, jamais d'erreur. */
export interface RapportJournalier {
  date: string;
  dossiersManipules: number;
  piecesAjoutees: number;
  affairesNouvelles: number;
  planificationActes: { dossierId: number; reference: string; datePlanifiee: string }[];
}

/** Issue d'une suppression : immédiate (DJ/DJA, 200) ou soumise à décision (juriste, 202). */
export type ResultatSuppression =
  | { immediate: true; document: DocumentDossier }
  | { immediate: false; demande: DemandeSuppression };

/** Document rattaché à un dossier (#43). */
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
}

/**
 * Création d'un dossier (#1, FR-DOS-01).
 *
 * Trois pièges du contrat, vérifiés dans `DossierService` du backend :
 * · `nature` est le **libellé** du référentiel, pas son code ni son identifiant — le backend le
 *   résout par `findByLibelleIgnoreCase` ;
 * · `categorie` est **déduite** de la nature (RG-DOS-02). L'envoyer n'est utile à rien et, si elle
 *   diverge, provoque un 400. Le formulaire la dérive côté client pour piloter ses champs, sans la
 *   transmettre ;
 * · `typeClientSensible` attend le **code** (`VIP`, `ENTREPRISE`, `PARTICULIER`), pas le libellé.
 */
export interface CreerDossier {
  reference: string;
  nature: string;
  juridictionSaisie: string;
  clientId: number;
  parties?: { demandeur?: string; defendeur?: string };
  risqueEncouru: number;
  recoursExerces?: string;
  motifRenvoi?: string;
  codeAgenceOrigine?: string;
  codeAgenceContentieuse?: string;
  /** Exigés ensemble pour un dossier `RECOUVREMENT` (Q-11, en ET et non en OU). */
  dossierCreditOrigine?: string;
  pvTransfert?: string;
  /** Exigés ensemble pour un dossier `EXPLOITATION_LITIGES`. */
  incidentCompteReference?: string;
  elementsJustificatifs?: string;
  champAlarme?: string;
  /** `seuilMontant` et `typeClientSensible` deviennent obligatoires quand ceci est vrai. */
  estSensible?: boolean;
  seuilMontant?: number;
  typeClientSensible?: string;
  /** Tous deux non vides : un dossier sans juriste ou sans avocat est refusé. */
  juristesAffectes: number[];
  avocatsAffectes: number[];
}

/** Filtres de `GET /dossiers` (#2). `mesDossiers` se résout sur l'utilisateur authentifié. */
export interface FiltresDossiers {
  nature?: string;
  categorie?: CategorieDossier;
  juridiction?: string;
  reference?: string;
  clientId?: number;
  mesDossiers?: boolean;
  page?: number;
  size?: number;
}

// ─────────────────────────────── Audiences et alarmes ───────────────────────────────

/** Audience d'une étape (#13, #14, #56). `datePlanifiee` et `dateTenue` sont des dates seules. */
export interface Audience {
  id: number;
  dossierId: number;
  etapeId: number;
  datePlanifiee: string;
  /** ⚠ Posée par le backend au jour de la **saisie** du compte rendu, pas au jour de l'audience (QF-32). */
  dateTenue: string | null;
  compteRendu: string | null;
  statut: StatutAudience;
  createdAt: string;
  /** Posés à l'annulation (QF-30, Q-76 backend) : motif obligatoire, horodatage sans fuseau. */
  motifAnnulation: string | null;
  dateAnnulation: string | null;
}

/**
 * Alarme d'une étape (#16, #17, #57). `dateEcheance` est un horodatage sans fuseau.
 * Reprogrammer clôt l'alarme (`TRAITEE`) et en crée une nouvelle qui la cite dans
 * `alarmePrecedenteId` : c'est une chaîne, pas une modification.
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

/** Ligne du calendrier (#15). Les affectations sont des identifiants, résolus en noms à l'affichage. */
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
  /** `YYYY-MM-DD`, strictement future (RG-AUD-07). */
  datePlanifiee: string;
}

export interface CreerAlarme {
  etapeId: number;
  objet: string;
  /** `YYYY-MM-DDTHH:mm`, strictement future. */
  dateEcheance: string;
}

export interface ReprogrammerAlarme {
  /** Facultatif : vide, l'objet de l'alarme précédente est repris. */
  objet?: string;
  dateEcheance: string;
}

// ─────────────────────────────── Délibérés ───────────────────────────────

/**
 * Délibéré (#58, cycle Q-78). Il naît à la mise en délibéré, **sans résultat** : `dateDeliberee` est
 * alors la date annoncée, que chaque prorogation remplace. `resultat` et `statutExpedition` ne
 * sont posés qu'une fois la décision rendue (`etat` = `VIDE`).
 */
export interface Delibere {
  id: number;
  dossierId: number;
  etapeId: number;
  dateDeliberee: string;
  etat: EtatDelibere;
  resultat: ResultatDelibere | null;
  statutExpedition: StatutExpedition | null;
  /** Horodatage sans fuseau ; seulement pour un résultat défavorable ou mixte. */
  dateEcheanceRecours: string | null;
  nombreProrogations: number;
  dateRabattement: string | null;
  motifRabattement: string | null;
  createdAt: string;
}

/** Prorogation (#19, historique 🆕 Q-78). `alerte` : au-delà du seuil — un avertissement, pas une erreur. */
export interface Prorogation {
  id: number;
  delibereId: number;
  date: string;
  motif: string | null;
  compteur: number;
  alerte: boolean;
  createdAt: string;
}

/** Suivi du délai de recours (#21), en lecture seule. */
export interface Recours {
  delibereId: number;
  dateEcheanceRecours: string | null;
  recoursExerce: boolean;
  delaiExpire: boolean;
  cloture: boolean;
}

/** #18 — sans `resultat` : mise en délibéré ; avec : délibéré déjà rendu, vidé d'un même geste. */
export interface EnregistrerDelibere {
  etapeId: number;
  dateDeliberee: string;
  resultat?: ResultatDelibere;
  dateEcheanceRecours?: string;
}

/** 🆕 Q-78 — la décision est rendue. Échéance exigée pour un résultat défavorable ou mixte. */
export interface ViderDelibere {
  resultat: ResultatDelibere;
  dateEcheanceRecours?: string;
}

export interface ProrogerDelibere {
  /** `YYYY-MM-DD`, strictement future (US 3.2). */
  date: string;
  motif?: string;
}

export interface RabattreDelibere {
  date: string;
  motif: string;
}

// ─────────────────────────────── Intervenants ───────────────────────────────

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
 * Invariants portés par le backend (#61, RG-INT-01/02) :
 * · un `AVOCAT` exige un `compteKeycloak` **unique** — 400 s'il manque, 409 s'il est déjà pris —
 *   et refuse le champ `notification` ;
 * · un `AUTRE_PRESTATAIRE` refuse tout compte applicatif.
 */
export interface CreerIntervenant {
  type: TypeIntervenant;
  nom: string;
  email?: string;
  telephone?: string;
  compteKeycloak?: string;
  notification?: boolean;
}

// ─────────────────────────────── Frais d'avocats ───────────────────────────────

/** Une décision du circuit (Q-82 backend) : qui, à quelle étape, quoi, pourquoi, quand. */
export interface ValidationFrais {
  etape: EtapeValidationFrais;
  decision: DecisionValidationFrais;
  motif: string | null;
  utilisateurId: number | null;
  utilisateurNom: string | null;
  dateValidation: string | null;
}

/**
 * Demande de frais (#23 à #28 et son détail, Q-82 backend). Elle se lit sans autre appel : dossier
 * et avocat nommés, décisions du circuit dans l'ordre. `validationConjointeRequise` applique la
 * règle RG-INT-03 (dossier sensible **ou** montant > `seuilApplicable`) — pour une demande qui n'a
 * pas encore atteint l'opportunité, c'est ce qui l'attend.
 *
 * `piecesJustificatives` : des **noms** déclarés par l'avocat, pas des fichiers (QF-26).
 */
export interface DemandeFrais {
  id: number;
  dossierId: number;
  referenceDossier: string;
  avocatId: number;
  avocatNom: string;
  montant: number;
  piecesJustificatives: string[];
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

// ─────────────────────────────── Publications ───────────────────────────────

/** Commentaire d'un juriste (#33) : destiné au DJ et à la DJA, jamais à l'avocat (RG-INT-07). */
export interface CommentairePublication {
  id: number;
  publicationId: number;
  auteurId: number | null;
  auteurNom: string | null;
  contenu: string;
  createdAt: string;
}

/** Correspondance unique du DJ/DJA à l'avocat (#34). */
export interface CorrespondanceAvocat {
  id: number;
  publicationId: number;
  auteurId: number | null;
  auteurNom: string | null;
  contenu: string;
  createdAt: string;
}

/**
 * Publication d'un avocat (#32, #59) : compte rendu d'audience (`contenu`, `audienceDate`) ou autre
 * publication (`typeDocument`, `nomFichier`). Depuis Q-86 backend, elle est nommée ;
 * `urlTelechargement` (10 minutes), `commentaires` et `correspondance` n'existent que sur le détail.
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

// ─────────────────────────────── Constitutions et répertoire ───────────────────────────────

/** Demande de constitution d'un prestataire (#35, #36, #60), nommée depuis Q-86 backend. */
export interface DemandeConstitution {
  id: number;
  dossierId: number;
  prestataireId: number;
  demandeurId: number;
  motif: string;
  statut: StatutConstitution;
  valideParId: number | null;
  motifRejet: string | null;
  /** Lettre générée à la signature du SH, déposée dans la GED du dossier. */
  lettreDocumentId: number | null;
  dateDemande: string;
  dateDecision: string | null;
  referenceDossier: string;
  prestataireNom: string;
  prestataireType: TypeIntervenant;
  demandeurNom: string | null;
  valideParNom: string | null;
}

/**
 * Avocat du répertoire (#37), trié par charge croissante. `indicateurCharge` : dossiers actifs ;
 * `indicateurPerformance` : part des délibérés favorables, entre 0 et 1 (0 sans délibéré).
 */
export interface AvocatRepertoire {
  id: number;
  nom: string;
  email: string | null;
  telephone: string | null;
  indicateurCharge: number;
  indicateurPerformance: number;
}
