import { Toaster } from "sonner";

import { AuthProvider } from "@/providers/session.provider";
import { QueryProvider } from "@/providers/query.provider";
import { ThemeProvider } from "@/providers/theme.provider";

export function AppProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
      <AuthProvider>
        <QueryProvider>{children}</QueryProvider>
      </AuthProvider>
      <Toaster position="bottom-right" richColors closeButton />
    </ThemeProvider>
  );
}
