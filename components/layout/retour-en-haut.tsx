"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Ramène le contenu en haut à chaque changement d'écran (QF-47).
 *
 * **Pourquoi c'est nécessaire.** Next remet la **fenêtre** à zéro en changeant de route. Depuis que
 * le contenu est devenu le conteneur de défilement sur grand écran, la fenêtre ne défile plus : sans
 * ce geste, on ouvrirait un nouvel écran déjà défilé, à la hauteur où l'on avait laissé le précédent.
 * Le symptôme est déroutant — un écran qui s'ouvre « au milieu », sans que rien ne l'explique.
 *
 * **Le changement de page d'un tableau n'est pas concerné**, et c'est voulu : la pagination navigue
 * avec `scroll: false` pour ne pas renvoyer l'utilisateur en haut de la liste à chaque clic. Ce
 * composant n'écoute que le **chemin**, pas les paramètres de requête — changer de page, de filtre
 * ou de taille laisse donc la position intacte.
 */
export function RetourEnHaut() {
  const chemin = usePathname();

  useEffect(() => {
    document.getElementById("contenu-principal")?.scrollTo({ top: 0 });
  }, [chemin]);

  return null;
}
