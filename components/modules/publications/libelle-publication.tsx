"use client";

import { useLocale, useTranslations } from "next-intl";

import type { Langue } from "@/i18n/config";
import { formaterDate } from "@/lib/utils";
import type { Publication } from "@/types/domaine";

/**
 * Short description of a publication, e.g. "Compte rendu d'audience du 12 sept. 2026" or
 * "Pièce — releve.pdf". Shared by the queue, the case file tab and the detail screen.
 */
export function useLibellePublication() {
  const t = useTranslations("publications");
  const td = useTranslations("domaine");
  const langue = useLocale() as Langue;
  return (publication: Publication) => {
    if (publication.type === "CR_AUDIENCE") {
      return publication.audienceDate
        ? t("libelleCr", { date: formaterDate(publication.audienceDate, langue) })
        : t("libelleCrSansDate");
    }
    const type = publication.typeDocument
      ? td(`TypeAutrePublication.${publication.typeDocument}` as never)
      : td("TypePublication.AUTRE");
    return publication.nomFichier ? t("libelleAutre", { type, nom: publication.nomFichier }) : type;
  };
}
