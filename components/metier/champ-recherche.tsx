"use client";

import { useEffect, useRef, useState } from "react";

import { Champ, Input } from "@/components/ui/champ";

/** Le temps laissé à la frappe pour se stabiliser, en millisecondes. */
export const DELAI_RECHERCHE = 300;

/**
 * Un champ de recherche qui filtre **au fil de la frappe** (QF-57).
 *
 * **Le défaut qu'il corrige.** Les filtres textuels des listes se validaient sur `onBlur` : il
 * fallait quitter le champ pour voir le résultat. Signalé en recette le 2026-10-14 - on tape, et
 * rien ne se passe ; on ne sait pas si l'application a compris, ni s'il faut valider.
 *
 * **Pourquoi `onBlur` avait été choisi, et ce qui a changé.** Le commentaire d'origine disait :
 * « écrire dans l'URL à chaque frappe produirait une requête et une entrée d'historique par
 * caractère ». La seconde moitié était déjà fausse - les filtres s'écrivent avec `router.replace`,
 * qui n'empile rien. La première était juste, et c'est précisément ce que ce délai règle : une
 * requête par **pause**, pas par caractère. Le projet avait déjà ce remède dans
 * `SelecteurCherchable`, avec la même valeur de 300 ms ; il n'était pas appliqué ici.
 *
 * **La saisie est locale, le filtre est dans l'URL.** Lier directement le champ à l'URL
 * réécrirait l'adresse à chaque lettre. L'état local absorbe la frappe et ne propage qu'à la pause.
 *
 * **Et il suit une remise à zéro venue d'ailleurs** : le bouton « Effacer les filtres », un lien
 * partagé, un retour arrière. Sans cela, le champ garderait à l'écran un mot qui ne filtre plus
 * rien.
 */
export function ChampRecherche({
  id,
  label,
  placeholder,
  valeur,
  onChangement,
  className,
  delai = DELAI_RECHERCHE,
}: {
  id: string;
  label: string;
  placeholder?: string;
  /** La valeur en vigueur, celle de l'URL. */
  valeur: string;
  /** Appelé une fois la frappe stabilisée, avec la saisie telle quelle. */
  onChangement: (valeur: string) => void;
  className?: string;
  /** Réglable pour les tests ; 300 ms partout ailleurs. */
  delai?: number;
}) {
  const [saisie, setSaisie] = useState(valeur);

  /*
   * `onChangement` est gardée dans une référence et non dans les dépendances de l'effet : une
   * fonction recréée à chaque rendu - ce qu'elle est presque toujours - relancerait le minuteur en
   * boucle. Même précaution que dans `SelecteurCherchable`.
   */
  const rappel = useRef(onChangement);
  useEffect(() => {
    rappel.current = onChangement;
  }, [onChangement]);

  // La valeur en vigueur a changé sans passer par la frappe : effacement, lien, retour arrière.
  useEffect(() => {
    setSaisie(valeur);
  }, [valeur]);

  useEffect(() => {
    // Déjà en vigueur : rien à propager, et surtout pas de requête à relancer.
    if (saisie === valeur) return;
    const minuteur = setTimeout(() => rappel.current(saisie), delai);
    return () => clearTimeout(minuteur);
  }, [saisie, valeur, delai]);

  return (
    <Champ id={id} label={label} className={className}>
      <Input
        id={id}
        placeholder={placeholder}
        value={saisie}
        onChange={(evenement) => setSaisie(evenement.target.value)}
      />
    </Champ>
  );
}
