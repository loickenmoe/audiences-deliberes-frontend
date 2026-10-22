"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { ErreurApi } from "@/lib/api/errors";

/**
 * The client is created in React state, not at module level: during server rendering a global
 * client would be shared across users' requests, and thus their data.
 */
export function QueryProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            /** Never retry 4xx errors: the result would be the same. */
            retry: (nbEchecs, erreur) => {
              if (erreur instanceof ErreurApi) {
                const statut = erreur.statut ?? 0;
                if (statut >= 400 && statut < 500) return false;
              }
              return nbEchecs < 2;
            },
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
