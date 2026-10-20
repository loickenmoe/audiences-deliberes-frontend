"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { CompteAvocatNonRattache } from "@/components/modules/portail/compte-non-rattache";
import { SelecteurCherchable } from "@/components/metier/selecteur-cherchable";
import { useMesDossiers } from "@/hooks/usePortailAvocat";
import { estCompteAvocatNonRattache } from "@/lib/api/errors";

/**
 * Selects a case file among those the lawyer is assigned to (user stories 4.1 and 5.1).
 *
 * Search is server-side, as the user types: loading a single page of recent case files would hide
 * older ones and prevent submissions on them, without any warning.
 * A lawyer with no case file sees an explanation rather than an empty selector: an assignment is
 * missing, there is nothing for them to fix.
 */
export function SelecteurDossier({
  valeur,
  onChangement,
  id = "dossier",
  obligatoire = true,
}: Readonly<{
  valeur: number | null;
  onChangement: (dossierId: number | null) => void;
  id?: string;
  /** False where the choice is only for reading, as in "Mes dossiers": an asterisk would be misleading. */
  obligatoire?: boolean;
}>) {
  const t = useTranslations("portail");
  const [recherche, setRecherche] = useState("");
  const requete = useMesDossiers(recherche || undefined);
  const dossiers = requete.data?.content ?? [];

  // Distinguish "not yet registered in the directory" from "no case file assigned": both are
  // legitimate states, but they call for different actions from the lawyer.
  if (estCompteAvocatNonRattache(requete.error)) return <CompteAvocatNonRattache />;

  /*
   * The "no case file" state is derived only from an unfiltered list: a search without results
   * means no case file matches, not that the lawyer has none.
   */
  if (!requete.isLoading && dossiers.length === 0 && recherche === "") {
    return (
      <p className="max-w-prose rounded border border-dashed border-bordure-forte bg-surface px-4 py-3 text-[length:var(--taille-sm)] text-texte-secondaire">
        {t("aucunDossier")}
      </p>
    );
  }

  return (
    <SelecteurCherchable
      id={id}
      label={t("dossier")}
      obligatoire={obligatoire}
      placeholder={t("choisirDossier")}
      valeur={valeur}
      onChangement={(choisi) => onChangement(choisi as number | null)}
      options={dossiers.map((dossier) => ({
        id: dossier.id,
        libelle: `${dossier.reference} - ${dossier.nature} (${dossier.juridictionSaisie})`,
      }))}
      onRecherche={setRecherche}
      chargement={requete.isLoading}
      className="max-w-md"
    />
  );
}
