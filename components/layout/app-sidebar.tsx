"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/global";
import { NAVIGATION } from "@/lib/navigation";
import { peut } from "@/lib/rbac";
import { cn } from "@/lib/utils";

/**
 * Navigation principale, filtrée par capacité. Une entrée non autorisée n'est pas affichée — et
 * resterait de toute façon refusée par le backend si l'URL était forcée.
 *
 * L'état actif est signalé par un filet rouge **et** par `aria-current` : la couleur seule ne
 * suffirait pas.
 */
export function AppSidebar({ roles }: { roles: readonly string[] }) {
  const chemin = usePathname();
  const t = useTranslations("navigation");
  const entrees = NAVIGATION.filter((e) => e.livre && peut(roles, e.capacite));

  return (
    <nav
      aria-label={t("principale")}
      className="flex w-64 shrink-0 flex-col border-r border-bordure bg-surface"
    >
      <div className="flex h-16 items-center border-b border-bordure px-5">
        <Logo hauteur={24} />
      </div>

      <ul className="flex flex-1 flex-col gap-0.5 p-3">
        {entrees.map(({ cle, href, icone: Icone }) => {
          const actif = chemin === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={actif ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded px-3 py-2 text-[length:var(--taille-sm)] transition-colors",
                  actif
                    ? "bg-surface-attenuee font-medium text-texte shadow-[inset_2px_0_0_var(--afb-rouge)]"
                    : "text-texte-secondaire hover:bg-surface-attenuee hover:text-texte",
                )}
              >
                <Icone size={16} aria-hidden />
                {t(cle)}
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="border-t border-bordure px-5 py-4 text-[length:var(--taille-xs)] text-texte-tertiaire">
        {t("modulesAVenir")}
      </p>
    </nav>
  );
}
