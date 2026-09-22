import { getTranslations } from "next-intl/server";

import { SelecteurLangue } from "@/components/global";
import { ClocheNotifications } from "@/components/layout/cloche-notifications";
import { UserNav } from "@/components/layout/user-nav";

export async function Navbar({
  nom,
  prenom,
  email,
  roles,
}: {
  nom?: string | null;
  prenom?: string | null;
  email?: string | null;
  roles: readonly string[];
}) {
  const t = await getTranslations("commun");

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-bordure bg-surface px-4 sm:px-6">
      <p className="truncate text-[length:var(--taille-lg)] font-semibold tracking-tight">
        {t("application")}
      </p>
      <div className="flex shrink-0 items-center gap-3 sm:gap-5">
        <ClocheNotifications />
        <SelecteurLangue />
        <UserNav nom={nom} prenom={prenom} email={email} roles={roles} />
      </div>
    </header>
  );
}
