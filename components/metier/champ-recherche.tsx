"use client";

import { useEffect, useRef, useState } from "react";

import { Champ, Input } from "@/components/ui/champ";

/** Debounce delay for typing, in milliseconds. */
export const DELAI_RECHERCHE = 300;

/**
 * Search field that filters as the user types, with one request per pause rather than per character
 * (same 300 ms delay as `SelecteurCherchable`).
 * Input is held in local state and only propagated to the URL after the pause; the field also
 * follows a reset coming from elsewhere ("Clear filters" button, shared link, browser back).
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
  /** The current value, taken from the URL. */
  valeur: string;
  /** Called once typing has settled, with the raw input. */
  onChangement: (valeur: string) => void;
  className?: string;
  /** Configurable for tests; 300 ms everywhere else. */
  delai?: number;
}) {
  const [saisie, setSaisie] = useState(valeur);

  /*
   * `onChangement` is kept in a ref rather than in the effect dependencies: a function recreated on
   * each render would restart the timer in a loop.
   */
  const rappel = useRef(onChangement);
  useEffect(() => {
    rappel.current = onChangement;
  }, [onChangement]);

  // The current value changed without typing: reset, link or browser back.
  useEffect(() => {
    setSaisie(valeur);
  }, [valeur]);

  /*
   * The pending timer, kept so it can be cancelled; otherwise Enter would send the search and the
   * timer would send it again (two requests and two URL writes for the same input).
   */
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  function annuler() {
    if (minuteur.current === null) return;
    clearTimeout(minuteur.current);
    minuteur.current = null;
  }

  /** Search immediately without waiting for the pause (Enter key). */
  function chercherMaintenant(saisieCourante: string) {
    annuler();
    rappel.current(saisieCourante);
  }

  useEffect(() => {
    // Already applied: nothing to propagate and no request to resend.
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
        /* Enter searches immediately, without waiting for the pause. */
        onKeyDown={(evenement) => {
          if (evenement.key !== "Enter") return;
          evenement.preventDefault();
          chercherMaintenant(evenement.currentTarget.value);
        }}
        /*
         * Leaving the field searches immediately (this does not replace the debounce, it flushes
         * it).
         * Clicking a link blurs the field first, so the search is sent before navigation starts;
         * otherwise the pending timer's `router.replace` would fire after the click and override
         * the navigation.
         */
        onBlur={(evenement) => {
          if (minuteur.current === null) return;
          chercherMaintenant(evenement.currentTarget.value);
        }}
      />
    </Champ>
  );
}
