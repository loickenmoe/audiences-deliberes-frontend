"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { TAILLES_PAGE } from "@/hooks/const";

/**
 * Pagination adossée à la forme de réponse du backend : `{content, totalPages, totalElements}`.
 *
 * Le backend **ne renvoie pas** la page courante — elle est tenue par l'appelant. Ne pas la déduire
 * du nombre d'éléments : deux appels concurrents la feraient diverger.
 *
 * **Sélecteur de taille.** Dix lignes par défaut, pour qu'un tableau tienne sans défilement. Mais la
 * règle a un revers — retrouver un dossier parmi soixante demande six pages là où un défilement
 * suffisait. Le sélecteur rend la main à l'utilisateur : dix pour lire, cinquante pour balayer. Il
 * n'apparaît que si l'écran sait changer de taille (`onChangementTaille` fourni).
 */
export function Pagination({
  page,
  totalPages,
  totalElements,
  onChangement,
  taille,
  onChangementTaille,
  className,
}: {
  /** Index de page, base 0 — comme le backend. */
  page: number;
  totalPages: number;
  totalElements: number;
  onChangement: (page: number) => void;
  /** Taille courante ; omise, le sélecteur n'est pas rendu. */
  taille?: number;
  onChangementTaille?: (taille: number) => void;
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
