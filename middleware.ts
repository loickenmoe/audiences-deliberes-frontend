import { NextResponse, type NextRequest } from "next/server";

import {
  DUREE_MARQUEUR_S,
  MARQUEUR_DECONNEXION,
  estCookieDeSession,
} from "@/lib/marqueur-deconnexion";

/**
 * This middleware's only role is to make logout stick.
 *
 * Route guards (`exigerSession`/`exigerCapacite`) and the backend still check authentication and
 * permissions. A server component cannot clear a cookie, so while the logout marker is present, a
 * page request still carrying a session cookie is redirected to `/login` with the cookie cleared.
 * The marker survives this cleanup to handle a later revival; logging in removes it.
 */
export function middleware(requete: NextRequest) {
  if (!requete.cookies.has(MARQUEUR_DECONNEXION)) return NextResponse.next();

  const cookiesDeSession = requete.cookies.getAll().filter((c) => estCookieDeSession(c.name));
  if (cookiesDeSession.length === 0) return NextResponse.next();

  const reponse = NextResponse.redirect(new URL("/login", requete.url));
  for (const cookie of cookiesDeSession) {
    reponse.cookies.delete(cookie.name);
  }
  // Re-set the marker so consuming it does not drop its protection.
  reponse.cookies.set(MARQUEUR_DECONNEXION, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: DUREE_MARQUEUR_S,
    secure: process.env.NODE_ENV === "production",
  });
  return reponse;
}

/**
 * Pages only. API routes are deliberately excluded: redirecting a `fetch` to `/login` would hide the
 * error, and `/api/auth/session` must stay reachable to answer "no session" once the cookie is gone.
 */
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|brand).*)"],
};
