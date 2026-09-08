import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { COOKIE_LANGUE, LANGUE_PAR_DEFAUT, estLangue } from "@/i18n/config";

/**
 * Résolution de la langue à chaque requête, depuis le cookie de préférence.
 * Repli sur le français si le cookie est absent ou porte une valeur inconnue.
 */
export default getRequestConfig(async () => {
  const valeur = (await cookies()).get(COOKIE_LANGUE)?.value;
  const locale = estLangue(valeur) ? valeur : LANGUE_PAR_DEFAUT;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
