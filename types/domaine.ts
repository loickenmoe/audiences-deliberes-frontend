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
