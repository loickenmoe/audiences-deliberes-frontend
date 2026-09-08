"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { ErreurApi } from "@/lib/api/errors";

/**
 * Le client est créé dans un état React, pas en module : en rendu serveur, un client global serait
 * partagé entre les requêtes de plusieurs utilisateurs — et donc leurs données.
 */
export function QueryProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            /**
             * Ne jamais réessayer une erreur d'autorisation ou de validation : le résultat sera
             * identique et l'utilisateur attend pour rien.
             */
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
