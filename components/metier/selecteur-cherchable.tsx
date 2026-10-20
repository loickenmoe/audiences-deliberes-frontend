"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/** An option, reduced to what the component needs. */
export interface OptionCherchable {
  id: number;
  libelle: string;
  /**
   * Optional dimmed second line, to distinguish options with the same label (e.g. branches with the
   * same name in the same city). Shown only in the list, never in the field once selected.
   */
  sousLibelle?: string;
}

/**
 * Search-as-you-type picker (combobox): only shows what the server returns for the current input,
 * so search is exact regardless of the dataset size, unlike a dropdown that silently truncates.
 * Input is debounced for 300 ms to avoid one request per character.
 * Follows the ARIA `combobox` pattern. In multiple mode (e.g. case assignment, US 1.1), selected
 * choices are shown as removable chips under the field.
 */
export function SelecteurCherchable({
  valeur,
  onChangement,
  multiple = false,
  options,
  onRecherche,
  chargement = false,
  label,
  placeholder,
  id,
  obligatoire = false,
  className,
}: Readonly<{
  /** Selected id, or the list of ids in `multiple` mode. */
  valeur: number | null | readonly number[];
  onChangement: (valeur: number | null | number[]) => void;
  multiple?: boolean;
  options: readonly OptionCherchable[];
  /** Called once input has settled: this is what queries the server. */
  onRecherche: (recherche: string) => void;
  chargement?: boolean;
  label: string;
  placeholder?: string;
  id?: string;
  obligatoire?: boolean;
  className?: string;
}>) {
  const t = useTranslations("metier");
  const idAuto = useId();
  const idChamp = id ?? idAuto;
  const idListe = `${idChamp}-options`;

  const [saisie, setSaisie] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [indexActif, setIndexActif] = useState(0);
  const conteneur = useRef<HTMLDivElement>(null);

  const choisis = useMemo<readonly number[]>(
    () => (Array.isArray(valeur) ? valeur : valeur === null || valeur === undefined ? [] : [valeur as number]),
    [valeur],
  );
  /**
   * Labels of selected choices come from known options. In multiple mode a later search refreshes
   * the list, so labels already seen are remembered; otherwise a chip would go blank while typing.
   */
  const libellesConnus = useRef(new Map<number, string>());
  for (const option of options) libellesConnus.current.set(option.id, option.libelle);
  /*
   * The selected choice must stay displayed even after a later search refreshed the options. Fall
   * back on labels already seen, and only those: showing "#12" for an unknown id is worse than an
   * empty field.
   */
  const selection = useMemo(() => {
    if (multiple) return null;
    const trouvee = options.find((o) => o.id === valeur) ?? null;
    if (trouvee || typeof valeur !== "number") return trouvee;
    const connu = libellesConnus.current.get(valeur);
    return connu ? { id: valeur, libelle: connu } : null;
  }, [multiple, options, valeur]);

  // Let typing settle before querying the server.
  useEffect(() => {
    if (!ouvert) return;
    const minuteur = setTimeout(() => onRecherche(saisie), 300);
    return () => clearTimeout(minuteur);
    // `onRecherche` is intentionally left out of the dependencies: a function recreated on each
    // render would restart the search in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saisie, ouvert]);

  // A click outside closes the list without selecting anything.
  useEffect(() => {
    if (!ouvert) return;
    const surClic = (evenement: MouseEvent) => {
      if (!conteneur.current?.contains(evenement.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", surClic);
    return () => document.removeEventListener("mousedown", surClic);
  }, [ouvert]);

  function choisir(option: OptionCherchable) {
    libellesConnus.current.set(option.id, option.libelle);
    if (multiple) {
      const suivants = choisis.includes(option.id)
        ? choisis.filter((id) => id !== option.id)
        : [...choisis, option.id];
      onChangement([...suivants]);
      // The list stays open: a case is rarely assigned to a single person.
      setSaisie("");
      return;
    }
    onChangement(option.id);
    setSaisie("");
    setOuvert(false);
  }

  function surTouche(evenement: React.KeyboardEvent<HTMLInputElement>) {
    if (evenement.key === "ArrowDown") {
      evenement.preventDefault();
      setOuvert(true);
      setIndexActif((i) => Math.min(i + 1, options.length - 1));
    } else if (evenement.key === "ArrowUp") {
      evenement.preventDefault();
      setIndexActif((i) => Math.max(i - 1, 0));
    } else if (evenement.key === "Enter" && ouvert && options[indexActif]) {
      evenement.preventDefault();
      choisir(options[indexActif]);
    } else if (evenement.key === "Escape") {
      setOuvert(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-1", className)} ref={conteneur}>
      {/*
        The asterisk is outside the `<label>` (same rule as `Champ`) so it is not part of the
        accessible name. It is decorative: the requirement is announced by `aria-required` on the
        control.
      */}
      <div className="flex items-center gap-0.5">
        <label htmlFor={idChamp} className="text-[length:var(--taille-sm)] font-medium">
          {label}
        </label>
        {obligatoire ? (
          <span aria-hidden className="text-danger">
            *
          </span>
        ) : null}
      </div>

      <div className="relative">
        <input
          id={idChamp}
          type="text"
          role="combobox"
          aria-expanded={ouvert}
          aria-controls={idListe}
          aria-autocomplete="list"
          aria-activedescendant={ouvert && options[indexActif] ? `${idListe}-${options[indexActif].id}` : undefined}
          /*
           * `aria-required` rather than `required`: in multiple mode the field value is the current
           * input, usually empty, and native validation would block submission even with
           * selections. The form performs and reports the check.
           */
          aria-required={obligatoire || undefined}
          value={ouvert || multiple ? saisie : (selection?.libelle ?? "")}
          placeholder={placeholder ?? t("rechercherPlaceholder")}
          onFocus={() => setOuvert(true)}
          // Focus alone is not enough: after closing with Escape, the list must reopen on the next
          // click while the field still has focus.
          onClick={() => setOuvert(true)}
          onChange={(evenement) => {
            setSaisie(evenement.target.value);
            setIndexActif(0);
            setOuvert(true);
          }}
          onKeyDown={surTouche}
          className="w-full rounded border border-bordure bg-surface px-3 py-2 text-[length:var(--taille-sm)]"
        />

        {/*
          `aria-multiselectable` belongs on the list, not on the field: the list offers multiple
          choices.
        */}
        {ouvert ? (
          <ul
            id={idListe}
            role="listbox"
            aria-label={label}
            aria-multiselectable={multiple || undefined}
            className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded border border-bordure bg-surface shadow-[var(--ombre-carte)]"
          >
            {chargement ? (
              <li className="px-3 py-2 text-[length:var(--taille-sm)] text-texte-tertiaire">
                {t("rechercheEnCours")}
              </li>
            ) : options.length === 0 ? (
              <li className="px-3 py-2 text-[length:var(--taille-sm)] text-texte-tertiaire">
                {t("aucunResultat")}
              </li>
            ) : (
              options.map((option, index) => (
                <li
                  key={option.id}
                  id={`${idListe}-${option.id}`}
                  role="option"
                  aria-selected={choisis.includes(option.id)}
                  onMouseDown={() => choisir(option)}
                  className={cn(
                    "cursor-pointer px-3 py-2 text-[length:var(--taille-sm)]",
                    index === indexActif ? "bg-surface-attenuee" : "hover:bg-surface-attenuee",
                  )}
                >
                  {option.libelle}
                  {option.sousLibelle ? (
                    <span className="block text-[length:var(--taille-xs)] text-texte-tertiaire">
                      {option.sousLibelle}
                    </span>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>

      {multiple && choisis.length > 0 ? (
        <ul className="flex flex-wrap gap-2 pt-1">
          {choisis.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onChangement(choisis.filter((autre) => autre !== id))}
                className="flex items-center gap-1 rounded-full border border-bordure bg-surface-attenuee px-3 py-1 text-[length:var(--taille-xs)] hover:bg-surface"
              >
                {libellesConnus.current.get(id) ?? `#${id}`}
                <span aria-hidden>×</span>
                <span className="sr-only">{t("retirer")}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

    </div>
  );
}
