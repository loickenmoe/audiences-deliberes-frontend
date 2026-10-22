import type { Session } from "next-auth";
import { Toaster } from "sonner";

import { AlertesProvider } from "@/providers/alertes.provider";
import { AuthProvider } from "@/providers/session.provider";
import { QueryProvider } from "@/providers/query.provider";

/**
 * Light theme only, consistent with the bank's internal apps. Design tokens remain structured so a
 * dark theme can be added without a redesign.
 */
export function AppProvider({
  children,
  session,
}: Readonly<{ children: React.ReactNode; session: Session | null }>) {
  return (
    <>
      <AuthProvider session={session}>
        <QueryProvider>
          <AlertesProvider>{children}</AlertesProvider>
        </QueryProvider>
      </AuthProvider>
      <Toaster position="bottom-right" richColors closeButton />
    </>
  );
}
