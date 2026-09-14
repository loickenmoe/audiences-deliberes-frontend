import { Toaster } from "sonner";

import { AlertesProvider } from "@/providers/alertes.provider";
import { AuthProvider } from "@/providers/session.provider";
import { QueryProvider } from "@/providers/query.provider";

/**
 * QF-10 tranché : **thème clair uniquement**. L'application interne de référence (GFA) est claire,
 * l'usage est bureautique et diurne, et un second thème doublerait la surface de vérification des
 * contrastes sans bénéfice métier. Les jetons restent structurés pour qu'un thème sombre puisse
 * être ajouté sans refonte.
 */
export function AppProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AuthProvider>
        <QueryProvider>
          <AlertesProvider>{children}</AlertesProvider>
        </QueryProvider>
      </AuthProvider>
      <Toaster position="bottom-right" richColors closeButton />
    </>
  );
}
