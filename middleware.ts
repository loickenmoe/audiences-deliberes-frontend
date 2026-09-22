import { NextResponse, type NextRequest } from "next/server";

import {
  DUREE_MARQUEUR_S,
  MARQUEUR_DECONNEXION,
  estCookieDeSession,
} from "@/lib/marqueur-deconnexion";

/**
 * Seul rôle de ce middleware : faire tenir la déconnexion (QF-42).
 *
 * Il ne remplace pas les gardes de route — l'authentification et les droits restent vérifiés par
 * `exigerSession`/`exigerCapacite` dans les composants serveur, et par le backend. Il traite le seul
 * cas qu'un composant serveur ne **peut pas** traiter : effacer un cookie. Une session ressuscitée
 * après une déconnexion doit disparaître, et seul un middleware ou un gestionnaire de route peut
 * poser l'en-tête qui l'efface.
 *
 * Tant que le marqueur de déconnexion est présent, une requête de page qui porte encore un cookie de
 * session est renvoyée vers `/login`, cookie effacé. Le marqueur, lui, survit à ce nettoyage : une
 * seconde résurrection, plus tardive, doit être traitée de la même façon. C'est la connexion qui le
 * retire.
 */
export function middleware(requete: NextRequest) {
  if (!requete.cookies.has(MARQUEUR_DECONNEXION)) return NextResponse.next();

  const cookiesDeSession = requete.cookies.getAll().filter((c) => estCookieDeSession(c.name));
  if (cookiesDeSession.length === 0) return NextResponse.next();

  const reponse = NextResponse.redirect(new URL("/login", requete.url));
  for (const cookie of cookiesDeSession) {
    reponse.cookies.delete(cookie.name);
  }
  // Le marqueur est reposé pour ne pas perdre sa protection en le consommant.
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
 * Pages uniquement. Les routes d'API sont volontairement hors champ : rediriger un appel `fetch`
 * vers `/login` masquerait l'erreur au lieu de la dire, et leur réponse ne peut de toute façon pas
 * ouvrir d'écran. `/api/auth/session` en particulier doit rester joignable — c'est lui qui répondra
 * « pas de session » une fois le cookie effacé.
 */
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|brand).*)"],
};
