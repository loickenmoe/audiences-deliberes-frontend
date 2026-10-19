"use client";

import { useTranslations } from "next-intl";

import { EtatVide } from "@/components/global";

/**
 * The account belongs to a lawyer, but no directory record is linked to it.
 *
 * A dedicated screen rather than an error: nothing failed. A lawyer exists for the business once a
 * legal officer registers them in the directory with their login (RG-INT-01, UC-INT-01), not because
 * they have an account, and the lawyer cannot fix this themselves. The screen states what is missing,
 * that it is not their fault, and whom to contact - like the publication access restriction (ERR-009).
 */
export function CompteAvocatNonRattache({ titre }: { titre?: string }) {
  const t = useTranslations("portail");

  return (
    <EtatVide
      titre={titre ?? t("compteNonRattacheTitre")}
      description={t("compteNonRattacheTexte")}
    />
  );
}
