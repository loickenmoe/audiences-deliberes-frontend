"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/global";
import { NAVIGATION } from "@/lib/navigation";
import { peut } from "@/lib/rbac";
import { cn } from "@/lib/utils";

/**
 * Main navigation, filtered by capability. An unauthorised entry is not shown, and the backend would
 * refuse it anyway if the URL were forced.
 *
 * The active entry is marked by a red rule **and** `aria-current`: colour alone is not enough.
 *
 * Below `lg` it becomes a **horizontal strip** scrolling in its own container (a fixed-width sidebar
 * overflowed the screen on mobile): every entry stays reachable, with no toggle menu or extra JavaScript.
 */
export function AppSidebar({ roles }: Readonly<{ roles: readonly string[] }>) {
  const chemin = usePathname();
  const t = useTranslations("navigation");
  const entrees = NAVIGATION.filter((e) => e.livre && peut(roles, e.capacite));

  return (
    <nav
      aria-label={t("principale")}
      className="flex w-full shrink-0 flex-col border-b border-bordure bg-surface lg:h-svh lg:w-64 lg:border-b-0 lg:border-r"
    >
      {/*
        The application name is already in the header: on mobile this banner would duplicate it.

        The logo links home (`/`, unconditionally: one root for all profiles). The header no longer
        scrolls, so this logo is a permanent anchor where users expect to click.

        The link carries its own label and the logo becomes decorative: a link must announce its
        destination, not the owner of its image. No `aria-current` here: the "Home" entry below
        already carries it (for every profile, lawyer included).
      */}
      <div className="hidden h-16 items-center border-b border-bordure px-5 lg:flex">
        <Link
          href="/"
          aria-label={t("logoAccueil")}
          className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-anthracite"
        >
          <Logo hauteur={24} decoratif />
        </Link>
      </div>

      <ul className="flex flex-1 flex-row gap-0.5 overflow-x-auto p-2 lg:flex-col lg:overflow-y-auto lg:p-3">
        {entrees.map(({ cle, href, icone: Icone }) => {
          const actif = chemin === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={actif ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-3 whitespace-nowrap rounded px-3 py-2 text-[length:var(--taille-sm)] transition-colors",
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
    </nav>
  );
}
