"use client";

import { FilterX } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

/**
 * Filter bar. The calling screen provides the controls; this component adds layout, the
 * accessibility landmark and the reset button, which only appears when at least one filter is
 * active.
 */
export function BarreFiltres({
  children,
  nbFiltresActifs,
  onEffacer,
}: Readonly<{
  children: ReactNode;
  nbFiltresActifs: number;
  onEffacer: () => void;
}>) {
  const t = useTranslations("metier");

  return (
    <section
      aria-label={t("filtres")}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-bordure bg-surface px-4 py-3"
    >
      {children}
      {nbFiltresActifs > 0 ? (
        <Button variante="discrete" taille="sm" onClick={onEffacer}>
          <FilterX size={14} aria-hidden />
          {t("effacerFiltres")}
        </Button>
      ) : null}
    </section>
  );
}
