"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAVIGATION } from "@/lib/navigation";
import { peut } from "@/lib/rbac";
import { cn } from "@/lib/utils";

/**
 * Navigation filtrée par capacité. Une entrée non autorisée n'est pas affichée — et resterait de
 * toute façon refusée par le backend si l'utilisateur forçait l'URL.
 */
export function AppSidebar({ roles }: { roles: readonly string[] }) {
  const chemin = usePathname();
  const entrees = NAVIGATION.filter((e) => e.livre && peut(roles, e.capacite));

  return (
    <nav
      aria-label="Navigation principale"
      className="w-60 shrink-0 border-r border-(--color-border) bg-(--color-muted) p-4"
    >
      <p className="mb-4 px-2 font-mono text-[10px] uppercase tracking-[0.13em] text-(--color-muted-foreground)">
        Audiences et Délibérés
      </p>
      <ul className="flex flex-col gap-1">
        {entrees.map(({ titre, href, icone: Icone }) => {
          const actif = chemin === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={actif ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors",
                  actif
                    ? "bg-(--color-background) font-medium"
                    : "text-(--color-muted-foreground) hover:bg-(--color-background)",
                )}
              >
                <Icone size={16} aria-hidden />
                {titre}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 px-3 text-xs text-(--color-muted-foreground)">
        Les autres modules apparaîtront au fil des jalons.
      </p>
    </nav>
  );
}
