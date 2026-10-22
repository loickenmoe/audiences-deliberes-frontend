"use client";

import type { Session } from "next-auth";
import { SessionProvider, getSession, signOut, useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

import { apiClient, definirFournisseurDeJeton } from "@/lib/api/client";
import { definirLectureDeSession, jetonCourant } from "@/lib/cache-jeton";
import { ERREUR_AUTH_INDISPONIBLE, sessionInutilisable } from "@/lib/rotation-jeton";

/**
 * Wires the session token into the HTTP client through a cache rather than one `getSession()` per
 * request: each `/api/auth/session` read re-sets the session cookie and could undo a concurrent
 * logout. The cache only re-reads the session near the server-published rotation time.
 */
definirLectureDeSession(async () => {
  const session = await getSession();
  return session ? { accessToken: session.accessToken, rafraichirApres: session.rafraichirApres } : null;
});
definirFournisseurDeJeton(() => jetonCourant());

/**
 * Session bootstrap.
 *
 * The backend lazily creates the `utilisateur` row on the first call to an endpoint resolving the
 * current user (`GET /dossiers` and `GET /utilisateurs` do not). Without it, the user would be
 * missing from the directory and could not be assigned. `GET /alertes/mes-notifications` provisions
 * the account and also returns the notifications the header needs.
 */
function AmorcageSession() {
  const { data: session, status } = useSession();
  const amorce = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    /*
     * Rotation definitively failed: clean logout rather than a flood of 401s. The reason tells the
     * user what to do: log in again if the token expired, wait if the service is down.
     */
    if (sessionInutilisable(session?.erreur)) {
      const motif =
        session?.erreur === ERREUR_AUTH_INDISPONIBLE ? "auth-indisponible" : "session-expiree";
      void signOut({ redirectTo: `/login?motif=${motif}` });
      return;
    }

    if (amorce.current) return;
    amorce.current = true;

    apiClient.get("/alertes/mes-notifications", { params: { size: 1 } }).catch(() => {
      // Non-blocking: provisioning will happen on the next relevant call.
    });
  }, [status, session?.erreur]);

  return null;
}

/**
 * `session` comes from server rendering, so `SessionProvider` fetches nothing on mount.
 * `refetchOnWindowFocus` is off: token freshness is ensured by the token cache and by server
 * rendering of each page, so the UI triggers no session read.
 */
export function AuthProvider({
  children,
  session,
}: Readonly<{ children: React.ReactNode; session: Session | null }>) {
  return (
    <SessionProvider session={session} refetchOnWindowFocus={false}>
      <AmorcageSession />
      {children}
    </SessionProvider>
  );
}
