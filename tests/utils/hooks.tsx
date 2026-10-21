import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { expect, vi } from "vitest";

import fr from "@/messages/fr.json";

/**
 * A mocked service whose every method is a `vi.fn()` resolving to `valeur`, created on first
 * access. Lets a hook test assert the call without listing the service's methods.
 */
export function serviceSimule(valeur: unknown = {}): Record<string, ReturnType<typeof vi.fn>> {
  const methodes: Record<string, ReturnType<typeof vi.fn>> = {};
  return new Proxy(methodes, {
    get: (cible, nom: string) => (cible[nom] ??= vi.fn().mockResolvedValue(valeur)),
  });
}

function preparer() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidations = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="fr" messages={fr}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  return { client, invalidations, wrapper };
}

/** Runs a query hook to completion and returns its result. */
export async function executerRequete<T>(hook: () => { isSuccess: boolean; data?: T }) {
  const { wrapper } = preparer();
  const { result } = renderHook(hook, { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  return result.current.data;
}

/** Renders a query hook without waiting: for disabled queries, which never run. */
export function rendreRequete(hook: () => { fetchStatus: string }) {
  const { wrapper } = preparer();
  return renderHook(hook, { wrapper }).result.current;
}

/** Runs a mutation hook with `variables` and returns the query keys it invalidated. */
export async function executerMutation<V>(
  hook: () => { mutateAsync: (variables: V) => Promise<unknown> },
  variables: V,
): Promise<unknown[][]> {
  const { invalidations, wrapper } = preparer();
  const { result } = renderHook(hook, { wrapper });
  await act(async () => {
    await result.current.mutateAsync(variables);
  });
  return invalidations.mock.calls.map(([filtres]) => (filtres as { queryKey: unknown[] }).queryKey);
}
