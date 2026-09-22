"use client";

import { useLocale } from "next-intl";

import type { Langue } from "@/i18n/config";
import { formaterDate, formaterDateHeure, formaterFcfa, formaterOctets } from "@/lib/utils";

/**
 * Affichage des valeurs, localisé.
 *
 * Ces composants existent pour que **personne n'appelle `Intl` à la main dans un écran** : la
 * langue active doit être lue au même endroit, sinon un montant finit tôt ou tard formaté en
 * anglais dans une interface française.
 *
 * `data-nombres` déclenche l'alignement des chiffres (cf. `globals.css`) : indispensable dès qu'une
 * colonne de montants se compare verticalement.
 */
export function MontantFcfa({ valeur }: { valeur: number | null | undefined }) {
  const langue = useLocale() as Langue;
  return <span data-nombres>{formaterFcfa(valeur, langue)}</span>;
}

export function DateValeur({ valeur }: { valeur: string | null | undefined }) {
  const langue = useLocale() as Langue;
  // `dateTime` porte la valeur brute : lisible par une machine, indépendante de la langue.
  return <time dateTime={valeur ?? undefined}>{formaterDate(valeur, langue)}</time>;
}

export function DateHeureValeur({ valeur }: { valeur: string | null | undefined }) {
  const langue = useLocale() as Langue;
  return <time dateTime={valeur ?? undefined}>{formaterDateHeure(valeur, langue)}</time>;
}

/** Proportion entre 0 et 1, affichée en pourcentage entier. */
export function Pourcentage({ valeur }: { valeur: number | null | undefined }) {
  const langue = useLocale() as Langue;
  return (
    <span data-nombres>
      {valeur == null ? "—" : new Intl.NumberFormat(langue, { style: "percent", maximumFractionDigits: 0 }).format(valeur)}
    </span>
  );
}

export function PoidsFichier({ valeur }: { valeur: number | null | undefined }) {
  const langue = useLocale() as Langue;
  return <span data-nombres>{formaterOctets(valeur, langue)}</span>;
}
