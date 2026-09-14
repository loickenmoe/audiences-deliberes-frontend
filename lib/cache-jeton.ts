/**
 * Cache du jeton d'accès côté navigateur (QF-42).
 *
 * **Le problème qu'il résout.** Le fournisseur de jeton appelait `getSession()` à **chaque** requête
 * API. Or chaque lecture de `/api/auth/session` **repose le cookie de session** — vérifié en lisant
 * les en-têtes : `authjs.session-token.0/.1` sont réémis sur toutes les réponses. Un écran qui lance
 * huit requêtes produisait donc huit réécritures du cookie en quelques centaines de millisecondes.
 * Une déconnexion tombant dans cette rafale était **annulée** : la réponse de session partie avant
 * revenait après et réécrivait le cookie que la déconnexion venait d'effacer. Mesuré : 4 déconnexions
 * sur 5 laissaient la session ouverte.
 *
 * **Ce qu'il fait.** Le jeton est conservé en mémoire avec l'instant où le serveur le renouvellera.
 * Tant que cet instant n'est pas atteint, aucune requête réseau : la rafale disparaît, et avec elle
 * la course. Au-delà, une **seule** lecture de session est déclenchée même si vingt requêtes
 * l'attendent, et son résultat est partagé.
 *
 * **Pourquoi la fenêtre vient du serveur.** `lib/rotation-jeton.ts` retient le premier des deux
 * jetons qui expire (RF-02 : sur ce realm, le refresh token meurt **avant** l'access token). Refaire
 * ce calcul ici dupliquerait la règle la plus facile à se tromper de toute l'authentification : la
 * session publie `rafraichirApres`, le cache s'y fie.
 */

/** Ce que le cache retient d'une session lue. */
type EtatJeton = {
  jeton: string | null;
  /** Époque en millisecondes à partir de laquelle il faut relire la session. */
  valableJusqua: number;
};

/**
 * Sans `rafraichirApres` — session sans jetons, ou forme inattendue — on ne garde le jeton qu'un
 * court instant. Assez pour absorber la rafale d'un écran, trop peu pour servir un jeton périmé.
 */
const REPLI_MS = 30 * 1000;

let etat: EtatJeton | null = null;
let lectureEnCours: Promise<EtatJeton> | null = null;
let verrouille = false;

/**
 * Lecture de session, injectée plutôt qu'importée : `getSession` tire tout `next-auth/react`, que
 * les tests unitaires n'ont pas à monter pour vérifier une politique de cache.
 */
type LireSession = () => Promise<{ accessToken?: string; rafraichirApres?: number } | null>;

let lireSession: LireSession = async () => null;

export function definirLectureDeSession(lecture: LireSession): void {
  lireSession = lecture;
}

/**
 * Jeton d'accès courant. Ne touche au réseau que si le cache est vide ou sa fenêtre dépassée, et
 * jamais après {@link verrouillerJeton}.
 */
export async function jetonCourant(maintenant: number = Date.now()): Promise<string | null> {
  if (verrouille) return null;
  if (etat && maintenant < etat.valableJusqua) return etat.jeton;

  // Une seule lecture pour tous les appelants simultanés : c'est ce qui supprime la rafale.
  lectureEnCours ??= (async () => {
    try {
      const session = await lireSession();
      return {
        jeton: session?.accessToken ?? null,
        valableJusqua: session?.rafraichirApres ?? maintenant + REPLI_MS,
      };
    } finally {
      lectureEnCours = null;
    }
  })();

  const frais = await lectureEnCours;
  // Une session lue après le verrou ne doit pas ressusciter le jeton : la déconnexion prime.
  if (verrouille) return null;
  etat = frais;
  return frais.jeton;
}

/**
 * Ferme le robinet avant que la déconnexion ne parte. Sans lui, une lecture de session déclenchée
 * au même instant réécrirait le cookie juste après son effacement — la course que QF-42 décrit.
 * Le verrou ne vit que le temps de la navigation vers `/login` : la page suivante repart à neuf.
 */
export function verrouillerJeton(): void {
  verrouille = true;
  etat = null;
}

/**
 * Attend qu'aucune lecture de session ne soit plus en vol.
 *
 * C'est la seconde moitié du verrou, et celle qui rend la déconnexion **déterministe** : interdire
 * les nouvelles lectures ne suffit pas, puisque celle qui est déjà partie reviendra reposer le
 * cookie. La déconnexion attend donc qu'elle soit retombée avant de partir. L'attente est brève par
 * construction — il y a au plus une lecture en vol, mutualisée.
 */
export async function attendreLecturesEnCours(): Promise<void> {
  while (lectureEnCours) {
    await lectureEnCours.catch(() => undefined);
  }
}

/** Remet le cache à zéro. Réservé aux tests — un rechargement de page suffit en vrai. */
export function reinitialiserCacheJeton(): void {
  etat = null;
  lectureEnCours = null;
  verrouille = false;
}
