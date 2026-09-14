"use client";

import type { Session } from "next-auth";
import { SessionProvider, getSession, signOut, useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

import { apiClient, definirFournisseurDeJeton } from "@/lib/api/client";
import { definirLectureDeSession, jetonCourant } from "@/lib/cache-jeton";
import { ERREUR_RAFRAICHISSEMENT } from "@/lib/rotation-jeton";

/**
 * Branche le jeton de session sur le client HTTP.
 *
 * **Via un cache, et non un `getSession()` par requête** (QF-42) : chaque lecture de
 * `/api/auth/session` repose le cookie de session, si bien qu'un écran lançant huit requêtes
 * réécrivait huit fois le cookie — et pouvait annuler une déconnexion simultanée. Le cache ne relit
 * la session qu'à l'approche de la rotation, fenêtre publiée par le serveur ; `getSession()`
 * déclenche alors la rotation comme avant, et le jeton remis reste donc toujours valide.
 */
definirLectureDeSession(async () => {
  const session = await getSession();
  return session ? { accessToken: session.accessToken, rafraichirApres: session.rafraichirApres } : null;
});
definirFournisseurDeJeton(() => jetonCourant());

/**
 * Amorçage de session.
 *
 * **QF-16 — provisionnement paresseux.** Le backend ne crée la ligne `utilisateur` qu'au premier
 * appel d'un endpoint qui résout l'utilisateur courant ; `GET /dossiers` et `GET /utilisateurs` ne
 * le déclenchent pas. Sans cet appel, l'utilisateur connecté n'existe pas en base : il resterait
 * absent de l'annuaire, donc inaffectable, et son identifiant numérique introuvable (QF-02).
 *
 * `GET /alertes/mes-notifications` est le bon véhicule : il provisionne le compte **et** rapporte
 * les notifications dont l'en-tête a besoin sur toutes les pages. Un seul appel, deux usages.
 */
function AmorcageSession() {
  const { data: session, status } = useSession();
  const amorce = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    // Rotation définitivement échouée : déconnexion nette plutôt qu'une avalanche de 401.
    if (session?.erreur === ERREUR_RAFRAICHISSEMENT) {
      void signOut({ redirectTo: "/login?motif=session-expiree" });
      return;
    }

    if (amorce.current) return;
    amorce.current = true;

    apiClient.get("/alertes/mes-notifications", { params: { size: 1 } }).catch(() => {
      // Sans conséquence bloquante : le provisionnement se refera au prochain appel utile.
    });
  }, [status, session?.erreur]);

  return null;
}

/**
 * `session` vient du rendu serveur : `SessionProvider` n'a donc rien à aller chercher au montage.
 * `refetchOnWindowFocus` est coupé pour la même raison (QF-42) — la fraîcheur du jeton est assurée
 * par le cache, qui relit la session à l'approche de la rotation, et par le rendu serveur de chaque
 * page. Il ne reste alors **aucune** lecture de session déclenchée par l'interface.
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
