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

  /*
   * Le minuteur en cours, gardé pour pouvoir l'**annuler**. Sans cette référence, Entrée envoyait
   * la recherche puis le minuteur l'envoyait une seconde fois : deux requêtes et deux écritures
   * d'URL pour la même saisie, soit précisément ce que ce délai existe pour éviter. Trouvé par le
   * test de la touche Entrée.
   */
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  function annuler() {
    if (minuteur.current === null) return;
    clearTimeout(minuteur.current);
    minuteur.current = null;
  }

  /** Chercher sans attendre la pause : c'est ce que fait la touche Entrée. */
  function chercherMaintenant(saisieCourante: string) {
    annuler();
    rappel.current(saisieCourante);
  }

  useEffect(() => {
    // Déjà en vigueur : rien à propager, et surtout pas de requête à relancer.
    if (saisie === valeur) return;
    minuteur.current = setTimeout(() => {
      minuteur.current = null;
      rappel.current(saisie);
    }, delai);
    return annuler;
  }, [saisie, valeur, delai]);

  return (
    <Champ id={id} label={label} className={className}>
      <Input
        id={id}
        placeholder={placeholder}
        value={saisie}
        onChange={(evenement) => setSaisie(evenement.target.value)}
        /*
          **Entrée cherche tout de suite**, sans attendre la pause.
          Deux écrans offraient déjà ce raccourci avant QF-57 - la base jurisprudentielle et le
          répertoire des avocats. Le fil de la frappe le rend inutile, mais le retirer aurait enlevé
          une habitude à qui l'avait prise, et la touche est celle que tout le monde presse après
          avoir tapé une recherche.
        */
        onKeyDown={(evenement) => {
          if (evenement.key !== "Enter") return;
          evenement.preventDefault();
          chercherMaintenant(evenement.currentTarget.value);
        }}
        /*
          **Quitter le champ cherche aussitôt** (QF-61), et ce n'est pas un retour à `onBlur`.

          Le défaut qu'il corrige est sérieux et n'a rien d'une finesse : on tape une référence, on
          clique le résultat **dès qu'il apparaît**, et on revient à la liste. La minuterie en cours
          se déclenchait après le clic, et son `router.replace` écrasait la navigation déjà engagée
          vers la fiche. C'est le geste le plus naturel qui soit, et il échouait une fois sur deux
          selon qu'on cliquait dans les 300 ms.

          Cliquer un lien **retire d'abord le focus** : la recherche part donc ici, pendant le
          `blur`, avant que la navigation ne commence - et c'est alors la navigation qui a le
          dernier mot. Le fil de la frappe reste entier : ceci ne remplace pas le délai, il le
          vide quand il n'a plus lieu d'attendre.
        */
        onBlur={(evenement) => {
          if (minuteur.current === null) return;
          chercherMaintenant(evenement.currentTarget.value);
        }}
      />
    </Champ>
  );
}
