"use client";

import { Check, RotateCcw, Timer } from "lucide-react";
import { useTranslations } from "next-intl";

import { StatutCycleVie, type TypeEtape } from "@/types/enums";
import { cn } from "@/lib/utils";

/**
 * Frise du cycle de vie d'une étape de procédure (RG-DOS-04).
 *
 * C'est l'information la plus consultée de l'application : un juriste ouvre un dossier d'abord pour
 * savoir où en est la procédure. Elle apparaît donc à la fois dans la liste des dossiers (forme
 * compacte) et sur la fiche (forme détaillée).
 *
 *   OUVERTURE → EN_COURS → EN_DELIBERE → DELIBERE_VIDE → CLOTURE → ARCHIVE
 *
 * Deux boucles, que la ligne droite ne montre pas et qui comptent autant que la progression :
 * · **prorogation** — l'étape reste `EN_DELIBERE`, un nombre illimité de fois ;
 * · **rabattement** — le juge rouvre les débats, retour à `EN_COURS`.
 *
 * L'étape courante est signalée par le rouge de marque **et** par un point plein **et** par
 * `aria-current` : jamais par la couleur seule.
 */

const ETATS = StatutCycleVie;

export function CycleEtape({
  statut,
  type,
  nbProrogations,
  compact = false,
  className,
}: {
  statut: StatutCycleVie;
  /** Affiché en surtitre quand il est fourni : une même fiche porte 1 à 3 étapes. */
  type?: TypeEtape;
  /** Compteur de prorogations, si l'étape en a connu. */
  nbProrogations?: number;
  compact?: boolean;
  className?: string;
}) {
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
