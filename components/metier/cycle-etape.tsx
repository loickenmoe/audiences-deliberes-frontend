"use client";

import { Check, RotateCcw, Timer } from "lucide-react";
import { useTranslations } from "next-intl";

import { StatutCycleVie, type TypeEtape } from "@/types/enums";
import { cn } from "@/lib/utils";

/**
 * Timeline of a procedure step's lifecycle (RG-DOS-04), shown compact in the case list and detailed
 * on the case page.
 *   OUVERTURE → EN_COURS → EN_DELIBERE → DELIBERE_VIDE → CLOTURE → ARCHIVE
 * Two loops are not shown by the straight line: extension (the step stays `EN_DELIBERE`, unlimited
 * times) and reopening of proceedings (back to `EN_COURS`).
 * The current step is marked by the brand red, a filled dot and `aria-current`, never by color
 * alone.
 */

const ETATS = StatutCycleVie;

export function CycleEtape({
  statut,
  type,
  nbProrogations,
  compact = false,
  className,
}: Readonly<{
  statut: StatutCycleVie;
  /**
   * Shown when provided: as an overline in the expanded view, before the status in compact mode
   * (needed to tell the Supreme Court and CCJA appeals apart in the case list).
   */
  type?: TypeEtape;
  /** Number of extensions, if any. */
  nbProrogations?: number;
  compact?: boolean;
  className?: string;
}>) {
  const t = useTranslations("domaine");
  const tm = useTranslations("metier");
  const indexCourant = ETATS.indexOf(statut);

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <ol className="flex items-center gap-1" aria-label={tm("cycleEtape")}>
          {ETATS.map((etat, index) => {
            const franchi = index < indexCourant;
            const courant = index === indexCourant;
            return (
              <li
                key={etat}
                aria-current={courant ? "step" : undefined}
                title={t(`StatutCycleVie.${etat}` as never)}
                className={cn(
                  "h-1.5 rounded-full transition-colors",
                  courant ? "w-5 bg-[var(--afb-rouge)]" : "w-3",
                  franchi && "bg-texte-tertiaire",
                  !franchi && !courant && "bg-bordure-forte",
                )}
              />
            );
          })}
        </ol>
        <span className="text-[length:var(--taille-xs)] text-texte-secondaire">
          {type ? `${t(`TypeEtape.${type}` as never)} · ` : ""}
          {t(`StatutCycleVie.${statut}` as never)}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {type ? (
        <p className="font-mono text-[length:var(--taille-2xs)] uppercase tracking-[0.13em] text-texte-tertiaire">
          {t(`TypeEtape.${type}` as never)}
        </p>
      ) : null}

      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2" aria-label={tm("cycleEtape")}>
        {ETATS.map((etat, index) => {
          const franchi = index < indexCourant;
          const courant = index === indexCourant;
          return (
            <li key={etat} className="flex items-center gap-1.5">
              <span
                aria-current={courant ? "step" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 py-1 text-[length:var(--taille-xs)] transition-colors",
                  courant &&
                    "border-[var(--afb-rouge)] bg-surface font-medium text-texte shadow-[inset_0_-2px_0_var(--afb-rouge)]",
                  franchi && "border-bordure-forte bg-surface-attenuee text-texte-secondaire",
                  !franchi && !courant && "border-bordure text-texte-tertiaire",
                )}
              >
                {franchi ? <Check size={12} aria-hidden /> : null}
                {t(`StatutCycleVie.${etat}` as never)}
              </span>
              {index < ETATS.length - 1 ? (
                <span aria-hidden className="text-texte-tertiaire">
                  →
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[length:var(--taille-xs)] text-texte-secondaire">
        {nbProrogations && nbProrogations > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <Timer size={13} aria-hidden />
            {tm("prorogations", { nombre: nbProrogations })}
          </span>
        ) : null}
        {statut === "EN_DELIBERE" ? (
          <span className="inline-flex items-center gap-1.5">
            <RotateCcw size={13} aria-hidden />
            {tm("rabattementPossible")}
          </span>
        ) : null}
      </div>
    </div>
  );
}
