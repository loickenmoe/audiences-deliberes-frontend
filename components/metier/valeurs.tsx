"use client";

import { useLocale } from "next-intl";

import type { Langue } from "@/i18n/config";
import { formaterDate, formaterDateHeure, formaterFcfa, formaterOctets } from "@/lib/utils";

/**
 * Localized value display. Screens must not call `Intl` directly: the active language is read in
 * one place only. `data-nombres` enables tabular figures (see `globals.css`) for comparable amount
 * columns.
 */
export function MontantFcfa({ valeur }: Readonly<{ valeur: number | null | undefined }>) {
  const langue = useLocale() as Langue;
  return <span data-nombres>{formaterFcfa(valeur, langue)}</span>;
}

export function DateValeur({ valeur }: Readonly<{ valeur: string | null | undefined }>) {
  const langue = useLocale() as Langue;
  // `dateTime` holds the raw value: machine-readable and language-independent.
  return <time dateTime={valeur ?? undefined}>{formaterDate(valeur, langue)}</time>;
}

export function DateHeureValeur({ valeur }: Readonly<{ valeur: string | null | undefined }>) {
  const langue = useLocale() as Langue;
  return <time dateTime={valeur ?? undefined}>{formaterDateHeure(valeur, langue)}</time>;
}

/** Ratio between 0 and 1, displayed as a whole percentage. */
export function Pourcentage({ valeur }: Readonly<{ valeur: number | null | undefined }>) {
  const langue = useLocale() as Langue;
  return (
    <span data-nombres>
      {valeur == null ? "—" : new Intl.NumberFormat(langue, { style: "percent", maximumFractionDigits: 0 }).format(valeur)}
    </span>
  );
}

export function PoidsFichier({ valeur }: Readonly<{ valeur: number | null | undefined }>) {
  const langue = useLocale() as Langue;
  return <span data-nombres>{formaterOctets(valeur, langue)}</span>;
}
