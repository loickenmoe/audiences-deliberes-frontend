"use client";

import { SessionProvider, getSession, signOut, useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

import { apiClient, definirFournisseurDeJeton } from "@/lib/api/client";
import { ERREUR_RAFRAICHISSEMENT } from "@/lib/rotation-jeton";

/**
 * Branche le jeton de session sur le client HTTP. `getSession()` lit le cache de NextAuth et
 * déclenche la rotation côté serveur quand la fenêtre est dépassée : le jeton remis est donc
 * toujours valide, sans que les appelants aient à s'en préoccuper.
 */
definirFournisseurDeJeton(async () => (await getSession())?.accessToken ?? null);

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

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <SessionProvider>
      <AmorcageSession />
      {children}
    </SessionProvider>
  );
}
