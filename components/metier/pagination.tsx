"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { TAILLES_PAGE } from "@/hooks/const";

/**
 * Pagination based on the backend response shape `{content, totalPages, totalElements}`.
 * The backend does not return the current page: the caller owns it. Do not infer it from the
 * element count, as concurrent calls would make it diverge.
 * The page size selector (10 rows by default) only appears when `onChangementTaille` is provided.
 */
export function Pagination({
  page,
  totalPages,
  totalElements,
  onChangement,
  taille,
  onChangementTaille,
  className,
}: Readonly<{
  /** Zero-based page index, as in the backend. */
  page: number;
  totalPages: number;
  totalElements: number;
  onChangement: (page: number) => void;
  /** Current page size; when omitted, the selector is not rendered. */
  taille?: number;
  onChangementTaille?: (taille: number) => void;
  className?: string;
}>) {
  const t = useTranslations("metier");
  const premiere = page <= 0;
  const derniere = page >= totalPages - 1;

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className ?? ""}`}>
      <p className="text-[length:var(--taille-xs)] text-texte-secondaire" data-nombres>
        {t("elements", { nombre: totalElements })}
      </p>

      <div className="flex items-center gap-2">
        {taille !== undefined && onChangementTaille ? (
          <label className="flex items-center gap-2 text-[length:var(--taille-xs)] text-texte-secondaire">
            {t("lignesParPage")}
            <select
              value={taille}
              onChange={(evenement) => onChangementTaille(Number(evenement.target.value))}
              className="rounded border border-bordure bg-surface px-2 py-1 text-[length:var(--taille-xs)]"
            >
              {TAILLES_PAGE.map((valeur) => (
                <option key={valeur} value={valeur}>
                  {valeur}
                </option>
              ))}
            </select>
          </label>
        ) : null}

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
