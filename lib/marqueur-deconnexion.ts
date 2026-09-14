/**
 * Marqueur de déconnexion (QF-42).
 *
 * **Pourquoi un marqueur.** Effacer le cookie de session ne suffit pas à fermer une session : toute
 * réponse de `/api/auth/session` **repose** ce cookie, et NextAuth en déclenche une de lui-même
 * après chaque `getSession()`. Une réponse partie avant la déconnexion revient après elle et
 * ressuscite la session — mesuré à **1 ms** d'écart. Aucun aménagement côté navigateur ne ferme
 * cette fenêtre : le client ne décide pas de l'ordre d'arrivée des réponses.
 *
 * La déconnexion pose donc, en plus, un marqueur que le **serveur** lit à chaque requête. Tant qu'il
 * est là, toute session présentée est refusée et son cookie effacé : une session ressuscitée ne
 * survit pas à la requête suivante — et la requête suivante, c'est le chargement de `/login`.
 *
 * **Durée de vie.** Assez longue pour couvrir la résurrection, qui se produit dans la seconde ;
 * assez courte pour ne pas gêner. La connexion l'efface de toute façon ({@link connexion}), sans
 * quoi se reconnecter aussitôt après s'être déconnecté serait impossible.
 */
export const MARQUEUR_DECONNEXION = "deconnexion";

/** Trente secondes : la résurrection se joue dans la seconde, le reste est de la marge. */
export const DUREE_MARQUEUR_S = 30;

/** Vrai pour un cookie de session NextAuth, chunké (`.0`, `.1`) ou non, préfixé ou non en production. */
export function estCookieDeSession(nom: string): boolean {
  return nom.includes("session-token");
}
