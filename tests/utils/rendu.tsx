import { render as renderRtl, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import type { Langue } from "@/i18n/config";

const MESSAGES = { fr, en } as const;

/**
 * Renders a component in a given locale with the `next-intl` context. Rendering the same
 * component in both languages is the only way to catch hard-coded text.
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
