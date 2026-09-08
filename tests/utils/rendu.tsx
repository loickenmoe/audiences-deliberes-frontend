import { render as renderRtl, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import type { Langue } from "@/i18n/config";

const MESSAGES = { fr, en } as const;

/**
 * Rendu d'un composant dans une langue donnée.
 *
 * Tout composant traduit exige le contexte de `next-intl` ; cet utilitaire évite de le rebrancher
 * dans chaque test, et permet surtout de **vérifier le même composant dans les deux langues** —
 * c'est la seule façon d'attraper un texte resté en dur.
 */
export function rendre(
  element: ReactElement,
  { langue = "fr", ...options }: RenderOptions & { langue?: Langue } = {},
) {
  return renderRtl(element, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale={langue} messages={MESSAGES[langue]}>
        {children}
      </NextIntlClientProvider>
    ),
    ...options,
  });
}

export { MESSAGES };
