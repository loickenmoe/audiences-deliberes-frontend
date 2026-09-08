import { Toaster } from "sonner";

import { QueryProvider } from "@/providers/query.provider";
import { ThemeProvider } from "@/providers/theme.provider";

/**
 * Le fournisseur de session NextAuth sera ajouté ici au jalon F2.
 */
export function AppProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
      <QueryProvider>{children}</QueryProvider>
      <Toaster position="bottom-right" richColors closeButton />
    </ThemeProvider>
  );
}
