import type {
  CategorieDossier,
  FormatDocument,
  SeuilOrigine,
  StatutCycleVie,
  StatutValidation,
  TypeEtape,
  TypeIntervenant,
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
export interface DemandeSuppression {
  id: number;
  documentId: number;
  demandeurId: number | null;
  motif: string | null;
  statut: "EN_ATTENTE" | "APPROUVEE" | "REJETEE";
  dateDemande: string;
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
