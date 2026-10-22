"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { TAILLE_PAGE, TAILLES_PAGE } from "@/hooks/const";

/**
 * Filters and pagination synced to the URL, so a filtered search can be shared, bookmarked and
 * restored after going back. Any filter change resets to the first page, which would otherwise
 * possibly be empty.
 */
export function useFiltresUrl<T extends Record<string, string | undefined>>(defauts: T) {
  const router = useRouter();
  const chemin = usePathname();
  const parametres = useSearchParams();

  const filtres = useMemo(() => {
    const courant = { ...defauts };
    for (const cle of Object.keys(defauts) as (keyof T)[]) {
      const valeur = parametres.get(String(cle));
      if (valeur) courant[cle] = valeur as T[keyof T];
    }
    return courant;
  }, [defauts, parametres]);

  const page = useMemo(() => {
    const brut = Number.parseInt(parametres.get("page") ?? "0", 10);
    return Number.isNaN(brut) || brut < 0 ? 0 : brut;
  }, [parametres]);

  /**
   * Page size, also kept in the URL. Values outside `TAILLES_PAGE` are ignored, since the URL can
   * be edited by hand.
   */
  const taille = useMemo(() => {
    const brut = Number.parseInt(parametres.get("taille") ?? "", 10);
    return (TAILLES_PAGE as readonly number[]).includes(brut) ? brut : TAILLE_PAGE;
  }, [parametres]);

  /**
   * Last written query, pending reflection in the URL. `router.replace` is asynchronous, so neither
   * `parametres` nor `window.location.search` reflect it yet; without this, two filters set in quick
   * succession would overwrite each other.
   */
  const derniereEcriture = useRef<string | null>(null);

  // Once the URL catches up or changes for another reason (back, pasted link), the URL is the
  // source of truth again.
  const requeteCourante = parametres.toString();
  useEffect(() => {
    derniereEcriture.current = null;
  }, [requeteCourante]);

  const ecrire = useCallback(
    (modifications: Record<string, string | undefined>) => {
      const suivants = new URLSearchParams(derniereEcriture.current ?? requeteCourante);

      for (const [cle, valeur] of Object.entries(modifications)) {
        if (valeur === undefined || valeur === "") suivants.delete(cle);
        else suivants.set(cle, valeur);
      }

      const requete = suivants.toString();
      derniereEcriture.current = requete;
      // `scroll: false`: changing page must not scroll the user back to the top.
      router.replace(requete ? `${chemin}?${requete}` : chemin, { scroll: false });
    },
    [chemin, requeteCourante, router],
  );

  const definirFiltre = useCallback(
    (cle: keyof T, valeur: string | undefined) => {
      ecrire({ [String(cle)]: valeur, page: undefined });
    },
    [ecrire],
  );

  const definirPage = useCallback(
    (suivante: number) => ecrire({ page: suivante > 0 ? String(suivante) : undefined }),
    [ecrire],
  );

  /** Changing size resets to the first page, as the current page may not exist at the new size. */
  const definirTaille = useCallback(
    (suivante: number) =>
      ecrire({ taille: suivante === TAILLE_PAGE ? undefined : String(suivante), page: undefined }),
    [ecrire],
  );

  const effacer = useCallback(() => {
    router.replace(chemin, { scroll: false });
  }, [chemin, router]);

  const nbFiltresActifs = useMemo(
    () =>
      (Object.keys(defauts) as (keyof T)[]).filter((cle) => filtres[cle] !== defauts[cle]).length,
    [defauts, filtres],
  );

  return { filtres, page, taille, definirFiltre, definirPage, definirTaille, effacer, nbFiltresActifs };
}
