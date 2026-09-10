import type {
  CategorieDossier,
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
  createdAt: string;
  updatedAt: string;
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
