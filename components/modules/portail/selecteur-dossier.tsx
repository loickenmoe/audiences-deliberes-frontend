"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { CompteAvocatNonRattache } from "@/components/modules/portail/compte-non-rattache";
import { SelecteurCherchable } from "@/components/metier/selecteur-cherchable";
import { useMesDossiers } from "@/hooks/usePortailAvocat";
import { estCompteAvocatNonRattache } from "@/lib/api/errors";

/**
 * Choix d'un dossier parmi ceux auxquels l'avocat est affecté.
 *
 * C'est la pièce qui débloque tout le portail : jusqu'à Q-96, l'avocat devait fournir un
 * `dossierId` qu'aucun endpoint ne lui permettait de connaître (QF-01), alors que les stories 4.1
 * et 5.1 supposent qu'il le **choisisse**.
 *
 * **La recherche se fait sur le serveur** (2026-09-28). Le champ chargeait auparavant une page de
 * cent dossiers, les plus récents : un avocat qui en suit davantage ne voyait pas les autres, et
 * ne pouvait donc ni déposer de demande de frais ni de compte rendu pour ses dossiers anciens. Le
 * dossier existait, l'affectation aussi — seule la liste était tronquée, sans que rien ne le dise.
 * C'est le même piège que Q-105 sur l'annuaire des avocats, et la même réponse : interroger le
 * serveur au fil de la frappe plutôt que filtrer une page déjà réduite.
 *
 * Un avocat sans aucun dossier voit une explication plutôt qu'un sélecteur vide : il n'a rien à
 * corriger, c'est une affectation qui manque.
 */
export function SelecteurDossier({
  valeur,
  onChangement,
  id = "dossier",
  obligatoire = true,
}: {
  valeur: number | null;
  onChangement: (dossierId: number | null) => void;
  id?: string;
  /** Faux là où le choix ne sert qu'à lire, comme dans « Mes dossiers » (QF-64) : un astérisque y mentirait. */
  obligatoire?: boolean;
}) {
  const t = useTranslations("portail");
  const [recherche, setRecherche] = useState("");
  const requete = useMesDossiers(recherche || undefined);
  const dossiers = requete.data?.content ?? [];

  // Q-107 : distinguer « pas encore inscrit au répertoire » de « aucun dossier affecté ». Les deux
  // sont des états légitimes, mais ils n'appellent pas la même action de l'avocat.
  if (estCompteAvocatNonRattache(requete.error)) return <CompteAvocatNonRattache />;

  /*
   * L'état « aucun dossier » ne se déduit que d'une liste **non filtrée** : une recherche sans
   * résultat dit qu'aucun dossier ne porte cette référence, pas que l'avocat n'a pas de dossier.
   * Confondre les deux lui ferait croire qu'on lui a retiré ses affectations.
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
