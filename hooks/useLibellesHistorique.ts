"use client";

import { useTranslations } from "next-intl";

/**
 * Traduit ce qu'une ligne d'historique affiche : la nature de l'action, et les clés de ses détails.
 *
 * **Ce que cela ferme.** QF-24 — `historique_action.action` est une phrase **française** rédigée par
 * le backend, et les clés de `details` sont des identifiants techniques. En anglais, ces deux
 * colonnes restaient en français : l'écran signalait le défaut plutôt que de le corriger, faute de
 * pouvoir traduire une phrase libre.
 *
 * **Ce qui l'a rendu possible.** Q-111 a posé un **code typé** sur chaque ligne. La traduction
 * devient une correspondance code → libellé, entièrement côté client, sans repasser sur les
 * 42 points d'écriture du backend.
 *
 * **Le repli n'est pas décoratif.** Un code ajouté au backend et pas encore traduit ici doit
 * afficher la phrase française du backend, jamais le code brut ni un blanc : mieux vaut une ligne
 * lisible dans la mauvaise langue qu'une ligne illisible dans la bonne. Même principe pour une clé
 * de détail inconnue, rendue telle quelle.
 *
 * **La base, elle, ne change pas.** `action` reste la phrase enregistrée au moment du fait : c'est
 * la trace, et une trace ne se retraduit pas rétroactivement. Seul l'affichage est traduit.
 */
export function useLibellesHistorique() {
  const t = useTranslations("historique");

  return {
    /** Libellé de l'action, avec repli sur la phrase du backend pour un code non traduit. */
    libelleAction: (code: string, repli: string): string => {
      const traduit = t.has(`actions.${code}`) ? t(`actions.${code}` as never) : null;
      return traduit ?? repli;
    },
    /** Libellé d'une clé de `details`, avec repli sur la clé elle-même. */
    libelleDetail: (cle: string): string =>
      t.has(`details.${cle}`) ? t(`details.${cle}` as never) : cle,
  };
}
