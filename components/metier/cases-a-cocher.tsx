"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

import { cn } from "@/lib/utils";

/** An option, reduced to what the component needs. */
export interface OptionCase {
  id: number;
  libelle: string;
}

/**
 * Multiple choice with checkboxes, for a short list meant to be seen at a glance (e.g. the lawyers
 * of a case): each person is toggled with a single click, no modifier key needed. For long, growing
 * lists, use {@link SelecteurCherchable}.
 * The group is a `fieldset`/`legend` so screen readers announce its label; the number of checked
 * boxes is announced on each change.
 */
export function CasesACocher({
  label,
  options,
  valeur,
  onChangement,
  obligatoire = false,
  erreur,
  chargement = false,
  className,
}: Readonly<{
  label: string;
  options: readonly OptionCase[];
  valeur: readonly number[];
  onChangement: (valeur: number[]) => void;
  obligatoire?: boolean;
  erreur?: string;
  chargement?: boolean;
  className?: string;
}>) {
  const t = useTranslations("metier");
  const tc = useTranslations("commun");
  const id = useId();
  /** What the list says instead of options: still loading, or nothing to choose. */
  let messageListe: string | null = null;
  if (chargement) messageListe = tc("chargement");
  else if (options.length === 0) messageListe = t("aucunResultat");
  const idErreur = `${id}-erreur`;

  function basculer(optionId: number) {
    onChangement(valeur.includes(optionId) ? valeur.filter((v) => v !== optionId) : [...valeur, optionId]);
  }

  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-1.5", className)} aria-describedby={erreur ? idErreur : undefined}>
      {/* Must be the first child of the fieldset to name the group. */}
      <legend className="mb-1.5 text-[length:var(--taille-sm)] font-medium">
        {label}
        {obligatoire ? (
          <span aria-hidden className="text-danger">
            {" "}*
          </span>
        ) : null}
      </legend>

      <div
        className={cn(
          "flex max-h-48 flex-col divide-y divide-bordure overflow-y-auto rounded border bg-surface",
          erreur ? "border-danger" : "border-bordure-forte",
        )}
      >
        {messageListe ? (
          <p className="px-3 py-2 text-[length:var(--taille-sm)] text-texte-tertiaire">{messageListe}</p>
        ) : (
          options.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[length:var(--taille-sm)] hover:bg-surface-attenuee"
            >
              <input
                type="checkbox"
                checked={valeur.includes(option.id)}
                onChange={() => basculer(option.id)}
                className="h-4 w-4 shrink-0"
              />
              {option.libelle}
            </label>
          ))
        )}
      </div>

      <div className="flex items-start justify-between gap-3">
        {erreur ? (
          <p id={idErreur} className="text-[length:var(--taille-xs)] text-danger">
            {erreur}
          </p>
        ) : (
          <span />
        )}
        <span aria-live="polite" className="shrink-0 text-[length:var(--taille-xs)] text-texte-tertiaire">
          {t("selectionnes", { nombre: valeur.length })}
        </span>
      </div>
    </fieldset>
  );
}
