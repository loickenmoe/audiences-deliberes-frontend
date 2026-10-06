"use client";

import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";

import { SelecteurCherchable } from "@/components/metier/selecteur-cherchable";
import { useAgences } from "@/hooks/useReferentiels";

/**
 * Choix d'une agence de la banque (métier, 2026-10-03, observation 2).
 *
 * **Ce qu'il remplace.** Le code d'agence était deux champs de texte libre. Sur les 341 dossiers de
 * recette, un seul était renseigné - `5466546546` - et il ne désignait aucune agence : personne ne
 * connaît par cœur 82 codes à cinq chiffres, et rien ne signalait la faute.
 *
 * **Ce que la liste montre.** `code · Agence nom · ville`, à la demande du métier : le code pour
 * celui qui le connaît, le nom pour celui qui le cherche, la ville pour l'orienter. Le mot
 * « Agence » - « Branch » en anglais - précède le nom (métier, 2026-10-06) : les noms sont des
 * toponymes, et « 00001 HIPPODROME » pouvait se lire comme un lieu plutôt que comme une agence.
 * L'adresse vient en seconde ligne atténuée, car deux agences portent le même nom dans la même
 * ville - les deux « MBALLA II » de Yaoundé - et elle seule les sépare.
 *
 * **Pourquoi le code et non l'identifiant.** Le dossier porte le **code** en clair, sans clé
 * étrangère : c'est lui que la banque emploie dans ses propres états. Le sélecteur travaille donc
 * sur l'identifiant technique, qui seul est numérique, et rend le code au formulaire.
 *
 * **Ce qu'il ne propose pas.** Les agences fermées. Le backend les refuse à la création d'un
 * dossier, et les proposer ferait saisir un code voué au refus. Les dossiers déjà ouverts sous une
 * agence fermée, eux, restent intacts.
 */
export function SelecteurAgence({
  valeur,
  onChangement,
  label,
  id,
  obligatoire = false,
  className,
}: {
  /** Le **code** de l'agence choisie, tel que le dossier le porte, ou vide. */
  valeur: string | null | undefined;
  onChangement: (code: string | undefined) => void;
  label: string;
  id?: string;
  obligatoire?: boolean;
  className?: string;
}) {
  const t = useTranslations("metier");
  const [recherche, setRecherche] = useState("");
  const agences = useAgences({ recherche, actifSeulement: true });

  /*
   * La correspondance identifiant → code doit survivre au renouvellement des options : une fois le
   * choix fait, une nouvelle recherche remplace la liste, et sans mémoire le composant ne saurait
   * plus quel code il affiche ni lequel rendre au formulaire.
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
    // `t` est une dépendance réelle : le libellé change avec la langue.
  }, [agences.data, t]);

  const idChoisi = useMemo(() => {
    if (!valeur) return null;
    // D'abord la liste affichée, puis la mémoire : le choix retenu doit rester visible même si
    // une recherche ultérieure a renouvelé les options.
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
