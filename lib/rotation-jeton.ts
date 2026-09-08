/**
 * Politique de rotation des jetons Keycloak.
 *
 * Isolée de `lib/auth.ts` — qui ne peut pas être importé hors serveur — pour rester vérifiable par
 * des tests unitaires. C'est la pièce la plus facile à se tromper de toute l'authentification.
 */

/**
 * Marqueur porté par la session quand la rotation a définitivement échoué.
 *
 * Déclaré ici — et non dans `lib/auth.ts` — parce que le provider client doit le lire pour
 * déclencher la déconnexion : `lib/auth.ts` est un module serveur, l'importer depuis le navigateur
 * ferait échouer la compilation.
 */
export const ERREUR_RAFRAICHISSEMENT = "RafraichissementImpossible";

/** Marge avant expiration : le rafraîchissement doit aboutir avant la limite, pas pile dessus. */
export const MARGE_MS = 5 * 60 * 1000;

/**
 * Instant du prochain rafraîchissement, en millisecondes epoch.
 *
 * **Mesuré sur le realm réel (RF-02)** : le `refresh_token` vit **1800 s** quand l'`access_token`
 * en vit **3600 s**. Le patron le plus répandu — se caler sur l'expiration de l'access token —
 * échouerait donc systématiquement : à 55 minutes, le refresh token est mort depuis 25 minutes, et
 * l'utilisateur est déconnecté en pleine saisie.
 *
 * On retient donc **le premier des deux qui expire**, moins la marge. Chaque rotation renouvelle les
 * deux jetons et repousse la fenêtre.
 */
export function prochainRafraichissement(expiresAt: number, refreshExpiresAt: number): number {
  return Math.min(expiresAt, refreshExpiresAt) - MARGE_MS;
}

/** Vrai si les jetons doivent être renouvelés maintenant. */
export function doitRafraichir(
  maintenant: number,
  expiresAt: number | undefined,
  refreshExpiresAt: number | undefined,
): boolean {
  if (!expiresAt || !refreshExpiresAt) return true;
  return maintenant >= prochainRafraichissement(expiresAt, refreshExpiresAt);
}
