"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

import { cn } from "@/lib/utils";

/** Une option, réduite à ce dont le composant a besoin. */
export interface OptionCase {
  id: number;
  libelle: string;
}

/**
 * Choix multiple par cases à cocher (2026-09-22).
 *
 * **Pour une liste courte, qu'on veut voir d'un coup d'œil** : les juristes d'un dossier. Chaque
 * personne se coche ou se décoche d'un clic, sans touche à maintenir. C'est ce qui manquait à la liste
 * native à sélection multiple qu'il remplace : il fallait y tenir Ctrl (ou Cmd), un clic sans Ctrl
 * effaçait toute la sélection sans rien signaler, et la zone ne montrait que deux lignes. Pour une
 * liste longue et qui grandit — les avocats —, c'est {@link SelecteurCherchable} qui convient.
 *
 * Le groupe porte son intitulé (`fieldset` / `legend`) : un lecteur d'écran annonce « Juristes
 * affectés » avant chaque case. Le nombre de cases cochées est annoncé à chaque changement.
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
}: {
  label: string;
  options: readonly OptionCase[];
  valeur: readonly number[];
  onChangement: (valeur: number[]) => void;
  obligatoire?: boolean;
  erreur?: string;
  chargement?: boolean;
  className?: string;
}) {
  const t = useTranslations("metier");
  const tc = useTranslations("commun");
  const id = useId();
  const idErreur = `${id}-erreur`;

  function basculer(optionId: number) {
    onChangement(valeur.includes(optionId) ? valeur.filter((v) => v !== optionId) : [...valeur, optionId]);
  }

  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-1.5", className)} aria-describedby={erreur ? idErreur : undefined}>
      {/* Premier enfant du fieldset : c'est à cette condition qu'il nomme le groupe. */}
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
        {chargement ? (
          <p className="px-3 py-2 text-[length:var(--taille-sm)] text-texte-tertiaire">{tc("chargement")}</p>
        ) : options.length === 0 ? (
          <p className="px-3 py-2 text-[length:var(--taille-sm)] text-texte-tertiaire">{t("aucunResultat")}</p>
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
