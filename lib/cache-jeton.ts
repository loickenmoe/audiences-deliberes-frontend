/**
 * Browser-side access token cache.
 *
 * Every read of `/api/auth/session` re-sets the session cookie. Reading it on every API request
 * caused bursts of cookie rewrites, and a logout landing in such a burst was undone by a session
 * response arriving after it. The token is therefore kept in memory until the server-provided
 * renewal time (`rafraichirApres`, computed by `lib/rotation-jeton.ts`); past it, a single shared
 * session read serves all waiting callers.
 */

/** What the cache keeps from a session read. */
type EtatJeton = {
  jeton: string | null;
  /** Epoch in milliseconds from which the session must be re-read. */
  valableJusqua: number;
};

/**
 * Without `rafraichirApres` (no tokens, unexpected shape), the token is kept briefly: enough to
 * absorb a screen's burst of requests, too short to serve a stale token.
 */
const REPLI_MS = 30 * 1000;

let etat: EtatJeton | null = null;
let lectureEnCours: Promise<EtatJeton> | null = null;
let verrouille = false;

/**
 * Session reader, injected rather than imported: `getSession` pulls all of `next-auth/react`, which
 * unit tests should not need.
 */
type LireSession = () => Promise<{ accessToken?: string; rafraichirApres?: number } | null>;

let lireSession: LireSession = async () => null;

export function definirLectureDeSession(lecture: LireSession): void {
  lireSession = lecture;
}

/**
 * Current access token. Hits the network only if the cache is empty or expired, and never after
 * {@link verrouillerJeton}.
 */
export async function jetonCourant(maintenant: number = Date.now()): Promise<string | null> {
  if (verrouille) return null;
  if (etat && maintenant < etat.valableJusqua) return etat.jeton;

  // A single read shared by all concurrent callers.
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
  // A session read after the lock must not revive the token: logout wins.
  if (verrouille) return null;
  etat = frais;
  return frais.jeton;
}

/**
 * Blocks session reads before logout; otherwise a concurrent read would re-set the cookie right
 * after it is cleared. The lock only lives until navigation to `/login`.
 */
export function verrouillerJeton(): void {
  verrouille = true;
  etat = null;
}

/**
 * Waits until no session read is in flight. Second half of the lock, making logout deterministic:
 * a read already sent would otherwise re-set the cookie. At most one shared read is in flight.
 */
export async function attendreLecturesEnCours(): Promise<void> {
  while (lectureEnCours) {
    await lectureEnCours.catch(() => undefined);
  }
}

/** Resets the cache. Test-only; a page reload does this in real use. */
export function reinitialiserCacheJeton(): void {
  etat = null;
  lectureEnCours = null;
  verrouille = false;
}
