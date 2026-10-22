/**
 * Keycloak token rotation policy, kept apart from the server-only `lib/auth.ts` so it can be unit
 * tested.
 */

/**
 * Session flag set when rotation has definitively failed. Declared here because the client
 * provider reads it, and `lib/auth.ts` is a server module.
 */
export const ERREUR_RAFRAICHISSEMENT = "RafraichissementImpossible";

/**
 * Flag set when the authentication service is unreachable (network, Keycloak down, server error).
 * Distinct from an expired session: telling the user to log in again would be wrong, since logging
 * in also requires Keycloak.
 */
export const ERREUR_AUTH_INDISPONIBLE = "AuthentificationIndisponible";

/** True if the session is unusable, whatever the reason. */
export function sessionInutilisable(erreur: string | undefined): boolean {
  return erreur === ERREUR_RAFRAICHISSEMENT || erreur === ERREUR_AUTH_INDISPONIBLE;
}

/** Margin before expiry: the refresh must complete before the deadline. */
export const MARGE_MS = 5 * 60 * 1000;

/**
 * Next refresh time, in epoch milliseconds.
 *
 * On this realm the `refresh_token` lives 1800 s while the `access_token` lives 3600 s, so relying
 * on access token expiry would fail. The earliest of the two expiries is used, minus the margin.
 */
export function prochainRafraichissement(expiresAt: number, refreshExpiresAt: number): number {
  return Math.min(expiresAt, refreshExpiresAt) - MARGE_MS;
}

/** True if the tokens must be renewed now. */
export function doitRafraichir(
  maintenant: number,
  expiresAt: number | undefined,
  refreshExpiresAt: number | undefined,
): boolean {
  if (!expiresAt || !refreshExpiresAt) return true;
  return maintenant >= prochainRafraichissement(expiresAt, refreshExpiresAt);
}
