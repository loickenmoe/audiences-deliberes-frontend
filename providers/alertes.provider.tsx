"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CLES } from "@/hooks/const";
import { nettoyerDeclencheur } from "@/lib/alertes";
import { ouvrirCanalAlertes, type CanalAlertes } from "@/lib/temps-reel";

/**
 * Canal temps réel des notifications, ouvert une seule fois pour toute la session (QF-11).
 *
 * Il vit dans la coquille authentifiée et non dans l'écran 03 : une alerte doit apparaître dans
 * l'en-tête quelle que soit la page affichée. À chaque poussée, le cache des notifications est
 * invalidé — l'écran et le badge relisent la même requête, et la liste reste celle du backend
 * plutôt qu'une copie locale qui divergerait au premier rechargement.
 *
 * `connecte` est publié pour que le repli HTTP se resserre quand le canal tombe.
 */
const ContexteAlertes = createContext<{ connecte: boolean }>({ connecte: false });

/** État du canal. `false` tant qu'aucune connexion n'est établie — le repli prend alors le relais. */
export function useCanalAlertes() {
  return useContext(ContexteAlertes);
}

export function AlertesProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const t = useTranslations("notifications");
  const [connecte, setConnecte] = useState(false);

  // La fonction de traduction est lue par un ref : dans les dépendances de l'effet, une identité
  // instable rouvrirait le canal à chaque rendu.
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
      // Le démontage peut précéder la fin de l'import dynamique : refermer aussitôt.
      if (abandonne) ouvert.arreter();
      else canal = ouvert;
    });

    return () => {
      abandonne = true;
      canal?.arreter();
    };
  }, [status, queryClient]);

  return <ContexteAlertes.Provider value={{ connecte }}>{children}</ContexteAlertes.Provider>;
}
