import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

/**
 * Same as {@link rendre}, for screens that call `useQuery`/`useMutation` themselves (services are
 * mocked by the test). Each render gets its own client, without retries, so one test's cache or
 * failed request never leaks into the next.
 */
export function rendreAvecRequetes(
  element: ReactElement,
  { langue = "fr", ...options }: RenderOptions & { langue?: Langue } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return renderRtl(element, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale={langue} messages={MESSAGES[langue]}>
          {children}
        </NextIntlClientProvider>
      </QueryClientProvider>
    ),
    ...options,
  });
}

export { MESSAGES };
