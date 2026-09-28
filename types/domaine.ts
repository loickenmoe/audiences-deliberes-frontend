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
 * `PUT /clients/{id}` — la référence n'y figure pas : elle est l'identifiant du client et reste
 * figée (décision du 2026-09-22). Un champ facultatif vidé part en `null` et devient absent.
 */
export interface ModifierClient {
  nom: string;
  email: string | null;
  telephone: string | null;
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
  /**
   * Nature typée de l'action (backend Q-111). C'est elle qui fait foi et sur laquelle portent les
   * filtres ; `action` n'en est que la formulation lisible, et ce qui variait autrefois dans la
   * phrase — nom de l'étape, sens d'une décision, clé de configuration — se trouve dans `details`.
   */
  code: string;
  action: string;
  details: Record<string, unknown> | null;
  dateAction: string;
}

/**
 * Une page d'audit (backend Q-112).
 *
 * Même forme qu'une page, plus `actionsDisponibles` : les natures réellement présentes, qui
 * alimentent un filtre à **liste fermée**. Depuis le typage des actions (Q-111) elle porte des codes
 * et non des phrases, si bien qu'une clé de configuration ne produit plus une entrée par paramètre.
 * Cette liste est indépendante des filtres en cours, sinon en choisir une ferait disparaître les
 * autres et l'on ne pourrait plus changer d'avis.
 *
 * ⚠ **L'audit ne couvre que les modifications** (RG-DOS-06). Aucune consultation n'est tracée, à
 * l'exception de celle de cet écran : l'absence de ligne ne prouve donc pas l'absence d'action.
 */
export interface PageAudit {
  content: HistoriqueAction[];
  totalPages: number;
  totalElements: number;
  actionsDisponibles: OptionActionAudit[];
}

/**
 * Une entrée du filtre par nature d'action : le **code** part au serveur, le **libellé** s'affiche.
 *
 * Le libellé est dérivé de l'énumération côté backend plutôt que lu sur la ligne — les entrées
 * reprises par la migration V18 portent encore leur ancienne phrase, et une même nature se serait
 * alors présentée plusieurs fois dans la liste.
 */
export interface OptionActionAudit {
  code: string;
  libelle: string;
}

/**
 * Une archive d'audit produite et scellée (backend Q-113).
 *
 * `empreinte` est le **SHA-256 du fichier déposé**. C'est lui qui permet de démontrer, des années
 * plus tard, que le fichier produit est celui qui a été scellé — et donc de distinguer une archive
 * d'une simple copie, qu'on peut rééditer en trois minutes.
 *
 * La clé de stockage n'est **pas** exposée : elle ne servirait qu'à contourner l'endpoint de
 * téléchargement, seul endroit où la récupération est tracée.
 */
export interface ArchiveAudit {
  id: number;
  /**
   * Référence lisible, `AUD-2026-0042` (backend Q-114). Elle **désigne** l'archive, là où
   * l'empreinte la **prouve** : on l'écrit dans un courrier, on la dicte au téléphone, et c'est par
   * elle qu'on retrouve l'empreinte. C'est aussi la seule chose identifiant l'archive que le fichier
   * puisse porter — tout ce qui décrit son contenu changerait ses octets en y étant écrit.
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

/**
 * Résultat d'une vérification d'empreinte (backend Q-114).
 *
 * `reconnue` à faux n'est **pas une erreur** : c'est une réponse, et souvent celle qu'on redoutait —
 * le document qu'on vous a remis ne correspond à aucune archive.
 */
export interface VerificationArchive {
  reconnue: boolean;
  archive: ArchiveAudit | null;
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
  /** Q-101 — `false` filtre les dossiers **non** sensibles ; `undefined` ne filtre pas. */
  estSensible?: boolean;
  /** Q-101 — `EN_ATTENTE` est la file des sensibilités à valider du DJ et de la DJA. */
  sensibiliteStatut?: StatutValidation;
  /** Les deux critères d'étape portent sur une **même** étape : « un appel en cours ». */
  typeEtape?: TypeEtape;
  statutEtape?: StatutCycleVie;
  /** La période porte sur les **audiences** : « les dossiers ayant eu une audience entre… ». */
  dateDebut?: string;
  dateFin?: string;
  tri?: TriDossiers;
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
  /** Posée par le backend à la **date planifiée** de l'audience, quel que soit le jour de saisie (QF-32). */
  dateTenue: string | null;
  /**
   * Là où l'audience se tient — distincte de `juridictionSaisie` du dossier, qui est celle de la
   * saisine. Une audience d'appel ne siège pas devant le tribunal qui a jugé. Héritée du dossier à
   * la planification faute d'indication contraire.
   */
  juridiction: string | null;
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
  /** `YYYY-MM-DD`, non antérieure à l'ouverture du dossier (RG-AUD-07 amendée). */
  datePlanifiee: string;
  /** Facultative : vide, elle reprend la juridiction du dossier — le cas du premier degré. */
  juridiction?: string;
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
 * · un `AVOCAT` exige un `compteKeycloak` **unique** — 400 s'il manque, 409 s'il est déjà pris ;
 * · un `AUTRE_PRESTATAIRE` refuse tout compte applicatif.
 *
 * `notification` vaut pour les deux depuis Q-119 : c'est le consentement du prestataire aux canaux
 * externes (SMS, WhatsApp, courriel personnel). Absent, il vaut `true` pour un avocat et `false`
 * pour un autre prestataire.
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
 * `PUT /intervenants/{id}` (Q-117) — ni le type ni l'identifiant de connexion n'y figurent : ils sont
 * figés, l'identité se gérant dans Keycloak. Le consentement aux notifications externes, lui, se
 * corrige pour les deux types (Q-119).
 */
export interface ModifierIntervenant {
  nom: string;
  email: string | null;
  telephone: string | null;
  notification: boolean | null;
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
 * **Deux listes, et c'est voulu.** `piecesJustificatives` est le tableau brut du dictionnaire des
 * données : il peut contenir d'anciens libellés, saisis avant que le téléversement n'existe, qui ne
 * désignent aucun fichier. `piecesTelechargeables` ne porte que les pièces **réellement stockées**,
 * avec le nom d'origine et une URL signée de courte durée — renseignée sur le **détail** seulement,
 * jamais sur la liste, comme l'URL d'un document de la GED.
 *
 * L'écran doit préférer la seconde : c'est sur les documents que porte le contrôle de conformité,
 * pas sur leurs noms.
 */
/** Une pièce justificative stockée, telle que le détail d'une demande de frais la rend. */
export interface PieceTelechargeable {
  /** Chemin de stockage ; sert de clé stable, jamais montré à l'utilisateur. */
  cle: string;
  nomFichier: string;
  /** URL signée, de courte durée : à utiliser tout de suite, pas à conserver. */
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
  /** Vide sur la liste ; renseignée sur le détail, pour les pièces réellement stockées. */
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
/**
 * Le contenu d'une lettre de constitution (backend Q-115 B2).
 *
 * **Le juriste rédige, le SH consulte.** C'est le même document lu par deux rôles : `modifiable` dit
 * lequel des deux usages reste ouvert, plutôt que de laisser l'écran le déduire d'un statut.
 *
 * `numero` est **nul tant que la lettre est un brouillon** : il est attribué à la signature, pour ne
 * pas brûler un numéro sur une demande sans suite — la série ne repart jamais à un, et les trous y
 * resteraient.
 */
export interface LettreConstitution {
  id: number;
  demandeId: number;
  numero: number | null;
  numeroPropose: number | null;
  /** `First Bank/DAJR/DR/CM/ABN/18` — l'écran le découpe sur « / », le serveur le stocke d'un bloc. */
  suffixeNumero: string;
  lieu: string;
  destinataireNom: string | null;
  destinataireQualite: string | null;
  destinataireVille: string | null;
  concerne: string | null;
  objet: string;
  corps: string;
  signataire: string;
  /** Faux dès que la lettre est signée : une pièce versée au dossier ne se retouche pas. */
  modifiable: boolean;
  dateGeneration: string | null;
  dateModification: string | null;
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

// ─────────────────────────────── Décisions définitives et jurisprudence ───────────────────────────────

/** Adjudication (#51) : décision définitive favorable à la Banque, sur une étape clôturée (RG-DEF-01/02). */
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

/** Condamnation pécuniaire (#52, #53) : seul son statut de paiement évolue (RG-DEF-03/04). */
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

/** Décisions d'un dossier (Q-88 backend), chaque liste de la plus récente à la plus ancienne. */
export interface DecisionsDossier {
  adjudications: Adjudication[];
  condamnations: Condamnation[];
}

export interface CreerAdjudication {
  /** Étape `CLOTURE` du dossier (400 sinon, RG-DEF-01). */
  etapeId: number;
  beneficiaire: string;
  statutComptabilisation: string;
  repriseProvision: boolean;
  restitutionSoulte: boolean;
  mutation: boolean;
  /** ≥ 0 (400 sinon). */
  reliquat: number;
  dateDecision: string;
}

/** Aucune précondition d'étape (Q-59) ; le statut de paiement commence toujours `EN_ATTENTE` (QF-40). */
export interface CreerCondamnation {
  etapeId?: number;
  sens: SensCondamnation;
  naturePaiement: string;
  dateDecision: string;
}

/** Jurisprudence (#54, #55) ; `urlTelechargement` pré-signée, valable 10 minutes. */
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

/** Indexation obligatoire (RG-DEF-05) ; fichier PDF de 10 Mo au plus ; dossier facultatif. */
export interface ArchiverJurisprudence {
  dossierId?: number;
  typeArchive: TypeArchiveJurisprudence;
  motsCles: string[];
  natureDecision: string;
  juridiction: string;
  dateDecision: string;
}

// ─────────────────────────────── Alertes et configurations ───────────────────────────────

/**
 * Notification destinée à un utilisateur (#45, #46). Le backend l'enregistre **avant** de tenter
 * la diffusion temps réel : une alerte n'est jamais perdue, seul le push peut manquer.
 *
 * `declencheur` est le texte métier, parfois préfixé d'un marqueur technique anti-doublon du type
 * `[delibereId:12] ` — l'affichage le retire (`lib/alertes.ts`).
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
 * Paramètre système (#47, #48). Les quatre derniers champs décrivent la **règle de saisie** de la
 * clé (backend Q-91) : le formulaire d'administration s'y conforme au lieu de redéclarer les
 * bornes, et le backend refuse de toute façon une valeur hors règle.
 */
export interface ConfigurationSysteme {
  cle: string;
  valeur: string;
  description: string | null;
  modifiablePar: string;
  dateModification: string | null;
  /**
   * Auteur de la dernière modification (backend Q-112). Nul tant que le paramètre n'a jamais
   * été modifié, ou si le compte de l'auteur a été supprimé depuis.
   */
  dernierAuteurId: number | null;
  typeValeur: TypeValeurConfiguration | null;
  valeurMinimale: number | null;
  valeurMaximale: number | null;
  valeursPossibles: string[];
  /**
   * Une liste peut être entièrement décochée (backend Q-118) : réglages de notification, où
   * « aucun canal » ou « aucun événement » est un choix, et non un oubli.
   */
  listeVideAutorisee: boolean;
}

/** Une ligne du tableau de supervision des notifications externes (backend D17). */
/**
 * Une audience d'une journée donnée, avec ce qui en a été rapporté (backend, écran 44).
 *
 * Les deux comptes rendus sont rendus côte à côte : celui du juriste, saisi sur l'audience, et
 * celui de l'avocat, déposé en publication **et validé**. C'est leur écart qui renseigne sur ce
 * qui reste à faire.
 */
export interface AudienceDuJour {
  audienceId: number;
  dossierId: number;
  referenceDossier: string;
  juridiction: string | null;
  etape: TypeEtape | null;
  statut: StatutAudience;
  /** Identifiants des juristes affectés au dossier ; l'écran les nomme. */
  juristesAffectes: number[];
  compteRenduJuriste: string | null;
  compteRenduAvocat: string | null;
  avocatDuCompteRendu: number | null;
  /**
   * Adresse signée de la pièce accompagnant le compte rendu de l'avocat — plumitif, note
   * d'audience —, ou `null` s'il n'en a pas joint. Le compte rendu du juriste est un texte : il
   * n'a jamais de pièce.
   */
  urlPieceJointeAvocat: string | null;
}

/**
 * Une audience passée dont le compte rendu du juriste manque encore.
 *
 * Le statut « tenue » n'étant posé qu'à la saisie, une audience passée restée « planifiée » est
 * exactement une audience sans compte rendu : aucune donnée supplémentaire n'est nécessaire.
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
  /** L'avocat a rapporté : reste à consigner côté banque. */
  compteRenduAvocatDepose: boolean;
}

export interface LigneCanalNotification {
  canal: string;
  /** En file, pas encore remises au moteur. */
  enAttente: number;
  /** Remises au moteur, sans confirmation encore reçue. */
  remises: number;
  /** Confirmées par un accusé du moteur. */
  confirmees: number;
  /** Abandonnées : tentatives épuisées, périmées, ou échec définitif du moteur. */
  echecs: number;
  /** Remises, mais restées sans aucun accusé au-delà du délai (backend Q-120). */
  sansRetour: number;
  /** Canal retenu pour un destinataire sans coordonnée utilisable (D14). */
  nonJoignables: number;
}

/** Un envoi à examiner : abandonné, sans retour, ou destinataire injoignable. */
export interface EnvoiNotificationEnDefaut {
  id: number;
  eventId: string;
  typeEvenement: string;
  canal: string;
  statut: string;
  destinataire: string | null;
  /** Destinataire réel quand la redirection hors production l'a remplacé (backend D10). */
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
  /** Interrupteur du backend : à false, rien ne part et tout reste journalisé. */
  engineActif: boolean;
  /**
   * Le moteur publie-t-il ses accusés ? Sinon (backend Q-121), « remise » est le dernier état connu
   * d'un envoi réussi, et la colonne des confirmations reste vide sans rien signaler.
   */
  suiviAccusesActif: boolean;
}

/**
 * Supervision du canal applicatif sur une fenêtre (backend Q-109, NF-ALR-02).
 *
 * **Deux taux, et les confondre serait la première erreur.** `tauxDelivrance` répond à l'exigence
 * NF-ALR-02 — le canal a-t-il fait son travail ? Seuls les échecs comptent contre nous : une alerte
 * remise plus tard, parce que son destinataire n'était pas connecté, a bien été délivrée, le canal
 * applicatif comprenant la liste des notifications. `tauxDiffusionTempsReel` mesure tout autre
 * chose : à quel point les gens sont connectés quand on les alerte. Un chiffre bas sur le second
 * n'est pas un défaut ; sur le premier, si.
 *
 * `observees` est le dénominateur réel — les alertes antérieures à la migration V16 n'ont pas
 * d'issue enregistrée et sont exclues. `nonTraitees` ne participe à aucun taux : une alerte
 * délivrée que personne n'a ouverte relève d'un autre problème.
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

// ─────────────────────────────── Reporting ───────────────────────────────

/**
 * Tableau de bord exécutif (#50, écran 39). Six indicateurs **temps réel, tous dossiers
 * confondus** : le backend ne les restreint ni à une période ni au portefeuille de l'appelant.
 *
 * `tauxSuccesRecouvrement` est un **ratio de 0 à 1**, pas un pourcentage — `Pourcentage` le met en
 * forme.
 */
export interface TableauDeBord {
  nbDossiersActifs: number;
  nbAudiencesPlanifiees: number;
  nbDemandesFraisEnAttente: number;
  nbProrogationsAlerte: number;
  tauxSuccesRecouvrement: number;
  provisionsReprises: number;
}

/**
 * Rapport d'activité sur une période (#49, écran 40). `type` n'est qu'une **étiquette** : ce sont
 * `dateDebut` et `dateFin` qui bornent le calcul (backend Q-63).
 *
 * Le backend répond **204 quand les quatre compteurs sont nuls** : c'est un état vide, pas une
 * erreur — le service le rend comme `null`.
 */
export interface Rapport {
  type: TypeRapport;
  dateDebut: string;
  dateFin: string;
  nbNouveauxDossiers: number;
  nbAudiencesTenues: number;
  nbDemandesFraisDeposees: number;
  nbDeliberesEnregistres: number;
  tauxSuccesRecouvrement: number;
  provisionsReprises: number;
}

// ─────────────────────────────── Portail Avocat ───────────────────────────────

/**
 * Dépôt d'une demande de frais par l'avocat (#23, écran 30, US 4.1).
 *
 * `piecesJustificatives` porte les **chemins de stockage** renvoyés par
 * `portailAvocatService.deposerPieceJustificative` (QF-26 corrigée par le backend Q-97) — c'est ce
 * que le dictionnaire des données prévoit : « chemins ou références des pièces ». Les fichiers sont
 * donc bien téléversés, en deux temps.
 */
export interface DeposerFrais {
  dossierId: number;
  /** > 0 (400 sinon). */
  montant: number;
  /** Au moins une pièce (400 sinon) : les clés renvoyées par le téléversement. */
  piecesJustificatives: string[];
  /** Unique — un doublon revient en 409 `ERR-006` sur ce champ. */
  referenceFacture: string;
}

/**
 * Dépôt d'un compte rendu d'audience (#29, écran 33, US 5.1). L'audience doit appartenir au
 * dossier, sans quoi le backend répond 404.
 *
 * Le **récit** est obligatoire ; la pièce qui l'étaye est facultative (backend Q-98) et se passe
 * à part, en multipart.
 */
export interface DeposerCompteRendu {
  dossierId: number;
  audienceId: number;
  contenu: string;
  /** Identifiant du seul lecteur autorisé ; omis, la publication suit les droits ordinaires. */
  restrictionAcces?: number;
}
