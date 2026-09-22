"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/** Une option, réduite à ce dont le composant a besoin. */
export interface OptionCherchable {
  id: number;
  libelle: string;
}

/**
 * Sélecteur à recherche au fil de la frappe (Q-105).
 *
 * **Le problème qu'il résout.** Une liste déroulante classique doit détenir toutes ses options. Tant
 * que l'annuaire tient dans une page, cela passe ; au-delà, elle se tronque **en silence** — le
 * collègue qu'on cherche n'apparaît pas, et rien à l'écran ne dit pourquoi. Élargir la page repousse
 * le problème sans le traiter : c'est le pis-aller que ce composant remplace.
 *
 * **Ce qu'il fait.** Il n'affiche que ce que le serveur lui renvoie pour la saisie en cours. La
 * recherche est donc exacte quel que soit le volume, et la quantité transférée ne dépend plus de la
 * taille du référentiel mais de ce que l'utilisateur tape.
 *
 * **Le délai de frappe n'est pas un détail.** Sans lui, chaque caractère déclencherait une requête :
 * « Fotso » en produirait cinq, dont quatre dont la réponse est jetée. La saisie est donc laissée au
 * repos 300 ms — assez pour ne pas inonder le serveur, assez peu pour que la liste suive la frappe.
 *
 * **Accessibilité.** Le motif `combobox` d'ARIA : le champ annonce la liste qu'il contrôle et
 * l'option active, de sorte qu'un lecteur d'écran suive les résultats sans les voir apparaître.
 *
 * **Choix multiple.** L'affectation d'un dossier retient plusieurs juristes et plusieurs avocats
 * (US 1.1 : au moins un de chaque). C'est justement là que le référentiel est le plus long, donc là
 * que la recherche sert le plus — laisser ces écrans en liste déroulante classique aurait vidé la
 * correction de sa substance. Les choix retenus s'affichent en jetons retirables sous le champ.
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
}: {
  /** Identifiant choisi, ou la liste des identifiants en mode `multiple`. */
  valeur: number | null | readonly number[];
  onChangement: (valeur: number | null | number[]) => void;
  multiple?: boolean;
  options: readonly OptionCherchable[];
  /** Appelée quand la saisie s'est stabilisée : c'est elle qui interroge le serveur. */
  onRecherche: (recherche: string) => void;
  chargement?: boolean;
  label: string;
  placeholder?: string;
  id?: string;
  obligatoire?: boolean;
  className?: string;
}) {
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
   * Les libellés des choix retenus viennent des options **connues**. En mode multiple, une
   * recherche ultérieure renouvelle la liste : un choix fait avant peut ne plus s'y trouver. On
   * mémorise donc les libellés déjà vus, sinon un jeton se viderait en cours de saisie.
   */
  const libellesConnus = useRef(new Map<number, string>());
  for (const option of options) libellesConnus.current.set(option.id, option.libelle);
  const selection = useMemo(
    () => (multiple ? null : (options.find((o) => o.id === valeur) ?? null)),
    [multiple, options, valeur],
  );

  // Laisse la frappe se stabiliser avant d'interroger le serveur.
  useEffect(() => {
    if (!ouvert) return;
    const minuteur = setTimeout(() => onRecherche(saisie), 300);
    return () => clearTimeout(minuteur);
    // `onRecherche` est volontairement hors dépendances : une fonction recréée à chaque rendu
    // relancerait la recherche en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saisie, ouvert]);

  // Un clic à l'extérieur referme la liste sans rien choisir.
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
      // La liste reste ouverte : on affecte rarement une seule personne.
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
      <label htmlFor={idChamp} className="text-[length:var(--taille-sm)] font-medium">
        {label}
        {obligatoire ? <span aria-hidden> *</span> : null}
      </label>

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
           * `aria-required` et non `required` : en choix multiple, la valeur du champ est la saisie en
           * cours, presque toujours vide. Dans un vrai `<form>` — celui de création d'un dossier —, le
           * contrôle natif bloquait l'envoi même avec des choix retenus, et avant la validation de
           * l'application. L'obligation reste annoncée aux lecteurs d'écran ; c'est le formulaire qui
           * la vérifie et la signale.
           */
          aria-required={obligatoire || undefined}
          value={ouvert || multiple ? saisie : (selection?.libelle ?? "")}
          placeholder={placeholder ?? t("rechercherPlaceholder")}
          onFocus={() => setOuvert(true)}
          // Le focus seul ne suffit pas : fermée par Échap, la liste doit se rouvrir au clic suivant,
          // alors que le champ a gardé le focus.
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
          `aria-multiselectable` porte sur la **liste**, pas sur le champ : c'est elle qui offre
          plusieurs choix. Le linter d'accessibilité l'a signalé, et il avait raison.
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
