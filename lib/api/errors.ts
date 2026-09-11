/**
 * Normalisation des erreurs de l'API.
 *
 * Le backend renvoie **systématiquement** `{code, message, details}` — vérifié en conditions réelles
 * le 2026-09-08 (401 `ERR-UNAUTHENTICATED`, 403 `ERR-FORBIDDEN`, `details: null` quand il n'y a rien
 * à préciser) — et depuis le 2026-09-09 un `champ` optionnel, présent uniquement lorsque l'erreur
 * vise un champ précis de la requête (QF-21). Cette forme est stable et fait contrat : elle remplace intégralement la normalisation
 * du projet de référence, qui attendait une structure `{messages: {...}}` sans rapport.
 */

/** Codes d'erreur applicatifs du backend (`common/error/ErrorCodes.java`). */
export const CodeErreur = {
  // Codes numérotés par le contrat d'API (REF-07 §6.1)
  METADONNEES_MANQUANTES: "ERR-001",
  REFERENCE_DOSSIER_DUPLIQUEE: "ERR-002",
  DOUBLON_AFFECTATION: "ERR-003",
  TRANSITION_NON_AUTORISEE: "ERR-004",
  DOUBLON_AUDIENCE: "ERR-005",
  FACTURE_EN_DOUBLE: "ERR-006",
  DOCUMENT_NON_CONFORME: "ERR-008",
  ACCES_RESTREINT_PUBLICATION: "ERR-009",
  // Codes génériques
  REQUETE_INVALIDE: "ERR-VALIDATION",
  NON_AUTHENTIFIE: "ERR-UNAUTHENTICATED",
  DROITS_INSUFFISANTS: "ERR-FORBIDDEN",
  RESSOURCE_INTROUVABLE: "ERR-NOT-FOUND",
  CONFLIT: "ERR-CONFLICT",
  REGLE_METIER_VIOLEE: "ERR-BUSINESS-RULE",
  ERREUR_INTERNE: "ERR-INTERNAL",
} as const;

export type CodeErreur = (typeof CodeErreur)[keyof typeof CodeErreur];

/**
 * `ERR-007` n'existe pas côté backend : au-delà du seuil, une prorogation est **enregistrée avec
 * succès** (201) et porte `alerte: true` dans son corps de réponse (arbitrage backend Q-17).
 * Ne jamais la présenter comme une erreur.
 */

/**
 * Corps d'erreur tel que renvoyé par le backend.
 *
 * `champ` nomme le champ de la requête à corriger, quand le backend le connaît — un doublon de
 * référence, de compte ou de facture. Il est **absent** du JSON pour toutes les erreurs qui ne
 * visent aucun champ (conflit d'état, droits insuffisants, erreur interne).
 */
export interface CorpsErreurApi {
  code: string;
  message: string;
  details: string | null;
  champ?: string | null;
}

/** Erreur d'API normalisée, seule forme propagée aux hooks et aux écrans. */
export class ErreurApi extends Error {
  readonly code: string;
  readonly statut: number | undefined;
  readonly details: string | null;

  /**
   * Champ de la requête que le backend désigne comme fautif, ou `null`. Distinct de `details`, qui
   * porte du texte destiné à un humain et non un identifiant exploitable.
   */
  readonly champ: string | null;

  constructor(params: {
    code: string;
    message: string;
    details?: string | null;
    champ?: string | null;
    statut?: number;
  }) {
    super(params.message);
    this.name = "ErreurApi";
    this.code = params.code;
    this.details = params.details ?? null;
    this.champ = params.champ ?? null;
    this.statut = params.statut;
  }

  /**
   * `ERR-003` et `ERR-005` ne sont **pas** des échecs : le backend demande une confirmation
   * explicite, que l'on rejoue avec `?forcer=true`. L'interface doit ouvrir un dialogue, jamais
   * afficher une notification d'erreur.
   */
  get demandeConfirmation(): boolean {
    return this.code === CodeErreur.DOUBLON_AFFECTATION || this.code === CodeErreur.DOUBLON_AUDIENCE;
  }
}

/** Messages par défaut, en français, pour les codes que le backend ne formule pas lui-même. */
const MESSAGES_PAR_DEFAUT: Record<string, string> = {
  [CodeErreur.METADONNEES_MANQUANTES]: "Des informations obligatoires sont manquantes.",
  [CodeErreur.REFERENCE_DOSSIER_DUPLIQUEE]: "Cette référence de dossier est déjà utilisée.",
  [CodeErreur.DOUBLON_AFFECTATION]: "Cette affectation existe déjà.",
  [CodeErreur.TRANSITION_NON_AUTORISEE]: "Ce changement d'étape n'est pas autorisé.",
  [CodeErreur.DOUBLON_AUDIENCE]: "Une audience est déjà planifiée à cette date pour cette étape.",
  [CodeErreur.FACTURE_EN_DOUBLE]: "Cette référence de facture a déjà été déposée.",
  [CodeErreur.DOCUMENT_NON_CONFORME]: "Format ou taille de document non conforme.",
  [CodeErreur.ACCES_RESTREINT_PUBLICATION]: "Cette publication ne vous est pas accessible.",
  [CodeErreur.REQUETE_INVALIDE]: "La demande est invalide.",
  [CodeErreur.NON_AUTHENTIFIE]: "Votre session a expiré. Reconnectez-vous.",
  [CodeErreur.DROITS_INSUFFISANTS]: "Vous n'avez pas les droits nécessaires pour cette action.",
  [CodeErreur.RESSOURCE_INTROUVABLE]: "Cet élément est introuvable.",
  [CodeErreur.CONFLIT]: "Cette opération entre en conflit avec l'état actuel des données.",
  [CodeErreur.REGLE_METIER_VIOLEE]: "Cette opération ne respecte pas une règle de gestion.",
  [CodeErreur.ERREUR_INTERNE]: "Une erreur interne est survenue. Réessayez dans un instant.",
};

const ERREUR_RESEAU = "Le serveur est injoignable. Vérifiez votre connexion.";

function estCorpsErreurApi(valeur: unknown): valeur is CorpsErreurApi {
  return (
    typeof valeur === "object" &&
    valeur !== null &&
    typeof (valeur as CorpsErreurApi).code === "string" &&
    typeof (valeur as CorpsErreurApi).message === "string"
  );
}

/**
 * Convertit n'importe quelle défaillance (réponse d'erreur, coupure réseau, exception) en
 * `ErreurApi`. Le message du backend est **préféré** au message par défaut : il est déjà rédigé en
 * français et porte souvent une précision métier utile.
 */
export function normaliserErreur(erreur: unknown): ErreurApi {
  const candidat = erreur as {
    response?: { status?: number; data?: unknown };
    request?: unknown;
    message?: string;
  };

  const corps = candidat?.response?.data;
  if (estCorpsErreurApi(corps)) {
    return new ErreurApi({
      code: corps.code,
      message: corps.message || MESSAGES_PAR_DEFAUT[corps.code] || "Une erreur est survenue.",
      details: corps.details ?? null,
      champ: corps.champ ?? null,
      statut: candidat.response?.status,
    });
  }

  // Réponse d'erreur sans corps exploitable : on retombe sur le code HTTP.
  const statut = candidat?.response?.status;
  if (typeof statut === "number") {
    const code = codeDepuisStatut(statut);
    return new ErreurApi({ code, message: MESSAGES_PAR_DEFAUT[code]!, statut });
  }

  // Requête partie sans réponse : serveur arrêté, DNS, CORS.
  if (candidat?.request) {
    return new ErreurApi({ code: "ERR-NETWORK", message: ERREUR_RESEAU });
  }

  return new ErreurApi({
    code: CodeErreur.ERREUR_INTERNE,
    message: candidat?.message || MESSAGES_PAR_DEFAUT[CodeErreur.ERREUR_INTERNE]!,
  });
}

function codeDepuisStatut(statut: number): string {
  switch (statut) {
    case 400:
      return CodeErreur.REQUETE_INVALIDE;
    case 401:
      return CodeErreur.NON_AUTHENTIFIE;
    case 403:
      return CodeErreur.DROITS_INSUFFISANTS;
    case 404:
      return CodeErreur.RESSOURCE_INTROUVABLE;
    case 409:
      return CodeErreur.CONFLIT;
    case 422:
      return CodeErreur.REGLE_METIER_VIOLEE;
    default:
      return CodeErreur.ERREUR_INTERNE;
  }
}

/** Message prêt à afficher, avec repli si l'erreur n'est pas une `ErreurApi`. */
export function messageErreur(erreur: unknown, repli = "Une erreur est survenue."): string {
  if (erreur instanceof ErreurApi) return erreur.message;
  return normaliserErreur(erreur).message || repli;
}
