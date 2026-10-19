import { getToken } from "@auth/core/jwt";
import { NextResponse } from "next/server";

import { signOut } from "@/lib/auth";
import { getEnvServeur } from "@/lib/env.server";
import { DUREE_MARQUEUR_S, MARQUEUR_DECONNEXION } from "@/lib/marqueur-deconnexion";

/**
 * Logout, in this order:
 * 1. Revoke the Keycloak session with the refresh token; otherwise it stays valid until expiry.
 * 2. Clear the application session cookie.
 * 3. Set the logout marker: a session read started just before logout could otherwise re-set the
 *    cookie; the marker lets the server reject and clear any session that reappears.
 *
 * Revocation is server-to-server (the login form lives in the app, so the browser never opened an
 * SSO session at Keycloak). The refresh token is read from the raw session token, never exposed
 * client-side. POST only, so a plain link or remote image cannot trigger a logout.
 */
export async function POST(requete: Request) {
  const env = getEnvServeur();

  const jeton = await getToken({
    req: requete,
    secret: env.AUTH_SECRET,
    salt: process.env.NODE_ENV === "production" ? "__Secure-authjs.session-token" : "authjs.session-token",
    secureCookie: process.env.NODE_ENV === "production",
  });

  const refreshToken = typeof jeton?.refreshToken === "string" ? jeton.refreshToken : null;
  if (refreshToken) {
    try {
      await fetch(`${env.KEYCLOAK_ISSUER}/protocol/openid-connect/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env.KEYCLOAK_CLIENT_ID,
          client_secret: env.KEYCLOAK_CLIENT_SECRET,
          refresh_token: refreshToken,
        }),
      });
    } catch {
      // Keycloak unreachable: log out locally anyway; the token will expire on its own.
    }
  }

  await signOut({ redirect: false });

  // Relative redirect: the browser resolves it against the address it actually used. Deriving the
  // origin from `requete.url` yields `localhost` when the server listens on all interfaces, and the
  // `Host` header is client-controlled.
  const reponse = new NextResponse(null, { status: 303, headers: { Location: "/login" } });
  reponse.cookies.set(MARQUEUR_DECONNEXION, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: DUREE_MARQUEUR_S,
    secure: process.env.NODE_ENV === "production",
  });
  return reponse;
}
