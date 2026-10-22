"use client";

import { useTranslations } from "next-intl";

/**
 * Translates a history row's action and detail keys. `historique_action.action` is a French
 * sentence written by the backend; each row also carries a typed code, mapped here to a label.
 * Fallback: an untranslated code shows the backend sentence (never the raw code or a blank), and
 * an unknown detail key is shown as is. Stored data is never retranslated; only display is.
 */
export function useLibellesHistorique() {
  const t = useTranslations("historique");

  return {
    /** Action label, falling back to the backend sentence for an untranslated code. */
    libelleAction: (code: string, repli: string): string => {
      const traduit = t.has(`actions.${code}`) ? t(`actions.${code}` as never) : null;
      return traduit ?? repli;
    },
    /** Label of a `details` key, falling back to the key itself. */
    libelleDetail: (cle: string): string =>
      t.has(`details.${cle}`) ? t(`details.${cle}` as never) : cle,
  };
}
