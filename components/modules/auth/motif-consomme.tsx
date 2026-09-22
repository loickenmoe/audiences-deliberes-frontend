"use client";

import { useEffect } from "react";

/**
 * Retire `?motif=…` de l'adresse **une fois le message affiché**.
 *
 * **Le défaut qu'il corrige.** Le motif de déconnexion vivait dans l'URL, et le message avec lui. Or
 * un message de ce genre dit « ce qui vient de se passer » : c'est un événement, pas une propriété
 * durable de la page. Tant qu'il restait dans la barre d'adresse, il survivait au rechargement, au
 * retour arrière, au signet — et surtout à la **restauration d'onglets** du navigateur. Signalé par
 * le porteur du projet, qui lisait « Votre session a expiré » en ouvrant son navigateur le lendemain,
 * sans avoir eu de session ce jour-là.
 *
 * **Pourquoi `replaceState` et non le routeur.** Il s'agit de corriger l'historique, pas de naviguer :
 * `router.replace` relancerait un rendu serveur et effacerait le message que l'on vient d'afficher.
 * `replaceState` réécrit l'adresse sans toucher à la page — et sans laisser d'entrée d'historique,
 * pour qu'un retour arrière ne ramène pas le motif.
 */
export function MotifConsomme() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("motif")) return;

    url.searchParams.delete("motif");
    window.history.replaceState(null, "", url.pathname + url.search);
  }, []);

  return null;
}
