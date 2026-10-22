"use client";

import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";

import { SelecteurCherchable } from "@/components/metier/selecteur-cherchable";
import { useAgences } from "@/hooks/useReferentiels";

/**
 * Picker for a bank branch, replacing free-text branch codes.
 * Options read `code · Branch name · city`, with the address as a dimmed second line because two
 * branches can share a name in the same city.
 * The case stores the branch code in clear text (no foreign key), so the picker works on the
 * technical id and returns the code to the form.
 * Closed branches are not offered: the backend rejects them when creating a case.
 */
export function SelecteurAgence({
  valeur,
  onChangement,
  label,
  id,
  obligatoire = false,
  className,
}: Readonly<{
  /** The selected branch **code**, as stored on the case, or empty. */
  valeur: string | null | undefined;
  onChangement: (code: string | undefined) => void;
  label: string;
  id?: string;
  obligatoire?: boolean;
  className?: string;
}>) {
  const t = useTranslations("metier");
  const [recherche, setRecherche] = useState("");
  const agences = useAgences({ recherche, actifSeulement: true });

  /*
   * The id → code mapping must survive option refreshes: once a choice is made, a new search
   * replaces the list, and without it the component would no longer know which code to display or
   * return.
   */
  const codesParId = useRef(new Map<number, string>());

  const options = useMemo(() => {
    const contenu = agences.data?.content ?? [];
    for (const agence of contenu) codesParId.current.set(agence.id, agence.code);
    return contenu.map((agence) => ({
      id: agence.id,
      libelle: `${agence.code} · ${t("prefixeAgence")} ${agence.nom} · ${agence.ville}`,
      sousLibelle: agence.adresse ?? undefined,
    }));
    // `t` is a real dependency: the label changes with the language.
  }, [agences.data, t]);

  const idChoisi = useMemo(() => {
    if (!valeur) return null;
    // Displayed list first, then the memory: the selected choice must stay visible even if a later
    // search has refreshed the options.
    const visible = options.find((option) => codesParId.current.get(option.id) === valeur);
    if (visible) return visible.id;
    for (const [identifiant, code] of codesParId.current) {
      if (code === valeur) return identifiant;
    }
    return null;
  }, [valeur, options]);

  return (
    <SelecteurCherchable
      chargement={agences.isLoading}
      className={className}
      id={id}
      label={label}
      obligatoire={obligatoire}
      options={options}
      placeholder={t("rechercherAgencePlaceholder")}
      valeur={idChoisi}
      onChangement={(choix) =>
        onChangement(typeof choix === "number" ? codesParId.current.get(choix) : undefined)
      }
      onRecherche={setRecherche}
    />
  );
}
