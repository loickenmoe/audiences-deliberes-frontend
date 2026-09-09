"use client";

import { FilterX } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

/**
 * Barre de filtres. Les contrôles sont fournis par l'écran appelant ; ce composant apporte la mise
 * en forme, le repère d'accessibilité et la remise à zéro.
 *
 * Le bouton d'effacement n'apparaît que si au moins un filtre est actif : un bouton toujours visible
 * mais souvent inopérant devient du bruit.
 */
export function BarreFiltres({
  children,
  nbFiltresActifs,
  onEffacer,
}: {
  children: ReactNode;
  nbFiltresActifs: number;
  onEffacer: () => void;
}) {
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
