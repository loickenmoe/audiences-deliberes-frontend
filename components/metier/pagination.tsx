"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/**
 * Pagination adossée à la forme de réponse du backend : `{content, totalPages, totalElements}`.
 *
 * Le backend **ne renvoie pas** la page courante — elle est tenue par l'appelant. Ne pas la déduire
 * du nombre d'éléments : deux appels concurrents la feraient diverger.
 */
export function Pagination({
  page,
  totalPages,
  totalElements,
  onChangement,
  className,
}: {
  /** Index de page, base 0 — comme le backend. */
  page: number;
  totalPages: number;
  totalElements: number;
  onChangement: (page: number) => void;
  className?: string;
}) {
  const t = useTranslations("metier");
  const premiere = page <= 0;
  const derniere = page >= totalPages - 1;

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className ?? ""}`}>
      <p className="text-[length:var(--taille-xs)] text-texte-secondaire" data-nombres>
        {t("elements", { nombre: totalElements })}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variante="secondaire"
          taille="sm"
          onClick={() => onChangement(page - 1)}
          disabled={premiere}
          aria-label={t("precedent")}
        >
          <ChevronLeft size={14} aria-hidden />
        </Button>

        <span
          className="text-[length:var(--taille-xs)] text-texte-secondaire"
          aria-live="polite"
          data-nombres
        >
          {t("page", { page: page + 1, total: Math.max(totalPages, 1) })}
        </span>

        <Button
          variante="secondaire"
          taille="sm"
          onClick={() => onChangement(page + 1)}
          disabled={derniere}
          aria-label={t("suivant")}
        >
          <ChevronRight size={14} aria-hidden />
        </Button>
      </div>
    </div>
  );
}
