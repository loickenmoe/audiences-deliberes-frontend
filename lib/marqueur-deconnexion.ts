/**
 * Logout marker.
 *
 * Clearing the session cookie is not enough: every `/api/auth/session` response re-sets it, so a
 * response sent before logout can revive the session. Logout therefore also sets a marker the
 * server reads on every request; while present, any session is rejected and its cookie cleared.
 * Login clears the marker ({@link connexion}) so the user can log back in immediately.
 */
export const MARQUEUR_DECONNEXION = "deconnexion";

/** The revival happens within a second; the rest is margin. */
export const DUREE_MARQUEUR_S = 30;

/** True for a NextAuth session cookie, chunked (`.0`, `.1`) or not, prefixed or not in production. */
export function estCookieDeSession(nom: string): boolean {
  return nom.includes("session-token");
}
