/**
 * API error normalization.
 *
 * The backend always returns `{code, message, details}` (`details: null` when there is nothing to
 * add), plus an optional `champ` only when the error targets a specific request field. This shape
 * is part of the API contract.
 */

/** Backend application error codes (`common/error/ErrorCodes.java`). */
export const CodeErreur = {
  // Codes numbered by the API contract (REF-07 §6.1)
  METADONNEES_MANQUANTES: "ERR-001",
  REFERENCE_DOSSIER_DUPLIQUEE: "ERR-002",
  DOUBLON_AFFECTATION: "ERR-003",
  TRANSITION_NON_AUTORISEE: "ERR-004",
  DOUBLON_AUDIENCE: "ERR-005",
  FACTURE_EN_DOUBLE: "ERR-006",
  DOCUMENT_NON_CONFORME: "ERR-008",
  ACCES_RESTREINT_PUBLICATION: "ERR-009",
  // Generic codes
  REQUETE_INVALIDE: "ERR-VALIDATION",
  NON_AUTHENTIFIE: "ERR-UNAUTHENTICATED",
  DROITS_INSUFFISANTS: "ERR-FORBIDDEN",
  /**
   * The account has `ROLE_AVOCAT` but no lawyer record is linked to it. Not a permission denial:
   * an enrolment state the UI explains instead of showing a failure (see `estCompteAvocatNonRattache`).
   */
  AVOCAT_NON_RATTACHE: "ERR-AVOCAT-NON-RATTACHE",
  RESSOURCE_INTROUVABLE: "ERR-NOT-FOUND",
  CONFLIT: "ERR-CONFLICT",
  REGLE_METIER_VIOLEE: "ERR-BUSINESS-RULE",
  ERREUR_INTERNE: "ERR-INTERNAL",
} as const;

export type CodeErreur = (typeof CodeErreur)[keyof typeof CodeErreur];

/**
 * There is no `ERR-007`: beyond the threshold, an extension is saved successfully (201) with
 * `alerte: true` in its response body. Never present it as an error.
 */

/**
 * Error body returned by the backend. `champ` names the request field to fix when known (duplicate
 * reference, account or invoice); it is absent for errors not tied to a field.
 */
export interface CorpsErreurApi {
  code: string;
  message: string;
  details: string | null;
  champ?: string | null;
}

/** Normalized API error, the only shape propagated to hooks and screens. */
export class ErreurApi extends Error {
  readonly code: string;
  readonly statut: number | undefined;
  readonly details: string | null;

  /** Request field flagged by the backend, or `null`. Unlike `details`, it is an identifier. */
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
   * `ERR-003` and `ERR-005` are not failures: the backend asks for explicit confirmation, replayed
   * with `?forcer=true`. The UI must open a dialog, never show an error notification.
   */
  get demandeConfirmation(): boolean {
    return this.code === CodeErreur.DOUBLON_AFFECTATION || this.code === CodeErreur.DOUBLON_AUDIENCE;
  }
}

/** Default French messages for codes the backend does not phrase itself. */
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
 * Converts any failure (error response, network outage, exception) into an `ErreurApi`. The backend
 * message is preferred over the default one: it often carries useful business detail.
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

  // Error response without a usable body: fall back on the HTTP status.
  const statut = candidat?.response?.status;
  if (typeof statut === "number") {
    const code = codeDepuisStatut(statut);
    return new ErreurApi({ code, message: MESSAGES_PAR_DEFAUT[code]!, statut });
  }

  // Request sent but no response: server down, DNS, CORS.
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

/**
 * True when the logged-in account is a lawyer but no directory record is linked to it yet.
 *
 * A lawyer exists for the business once a legal officer registers them with their login
 * (RG-INT-01, UC-INT-01); until then the user can do nothing. Detected by a dedicated code, since
 * `ERR-FORBIDDEN` also covers real permission denials and message text may change.
 */
export function estCompteAvocatNonRattache(erreur: unknown): boolean {
  return erreur instanceof ErreurApi && erreur.code === CodeErreur.AVOCAT_NON_RATTACHE;
}

/** Display-ready message, with a fallback if the error is not an `ErreurApi`. */
export function messageErreur(erreur: unknown, repli = "Une erreur est survenue."): string {
  if (erreur instanceof ErreurApi) return erreur.message;
  return normaliserErreur(erreur).message || repli;
}
