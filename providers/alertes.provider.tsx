"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { CLES } from "@/hooks/const";
import { nettoyerDeclencheur } from "@/lib/alertes";
import { ouvrirCanalAlertes, type CanalAlertes } from "@/lib/temps-reel";

/**
 * Real-time notification channel, opened once for the whole session.
 *
 * Lives in the authenticated shell so an alert shows in the header on any page. Each push
 * invalidates the notifications cache, so the screen and badge re-read the backend list rather than
 * a diverging local copy. `connecte` lets the HTTP fallback tighten when the channel drops.
 */
const ContexteAlertes = createContext<{ connecte: boolean }>({ connecte: false });

/** Channel state. `false` until connected, in which case the fallback takes over. */
export function useCanalAlertes() {
  return useContext(ContexteAlertes);
}

export function AlertesProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const t = useTranslations("notifications");
  const [connecte, setConnecte] = useState(false);

  // The translation function is read through a ref: as an effect dependency, its unstable identity
  // would reopen the channel on every render.
  const traduire = useRef(t);
  traduire.current = t;

  useEffect(() => {
    if (status !== "authenticated") return;

    let canal: CanalAlertes | null = null;
    let abandonne = false;

    void ouvrirCanalAlertes({
      surEtat: (etat) => {
        if (!abandonne) setConnecte(etat);
      },
      surAlerte: (alerte) => {
        if (abandonne) return;
        void queryClient.invalidateQueries({ queryKey: [CLES.notifications] });
        toast.info(traduire.current("nouvelle"), { description: nettoyerDeclencheur(alerte.declencheur) });
      },
    }).then((ouvert) => {
      // Unmount may happen before the dynamic import completes: close immediately.
      if (abandonne) ouvert.arreter();
      else canal = ouvert;
    });

    return () => {
      abandonne = true;
      canal?.arreter();
    };
  }, [status, queryClient]);

  // Stable value: consumers re-render when the channel status changes, not on every render here.
  const valeur = useMemo(() => ({ connecte }), [connecte]);
  return <ContexteAlertes.Provider value={valeur}>{children}</ContexteAlertes.Provider>;
}
