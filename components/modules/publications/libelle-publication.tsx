"use client";

import { useLocale, useTranslations } from "next-intl";

import type { Langue } from "@/i18n/config";
import { formaterDate } from "@/lib/utils";
import type { Publication } from "@/types/domaine";

/**
 * Ce qu'est une publication, en quelques mots : « Compte rendu d'audience du 12 sept. 2026 » ou
 * « Pièce — releve.pdf ». Partagé par la file, l'onglet de la fiche et le détail.
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
