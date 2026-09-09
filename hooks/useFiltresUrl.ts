"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

/**
 * Filtres et pagination synchronisés à l'URL.
 *
 * **Pourquoi l'URL plutôt qu'un état React** : un juriste doit pouvoir envoyer à un collègue le lien
 * de sa recherche filtrée, le mettre en favori, et retrouver sa liste après un retour arrière. Un
 * état local perdrait les trois.
 *
 * Tout changement de filtre **remet la pagination à la première page** : conserver la page 4 en
 * changeant de juridiction afficherait une page vide, ce que l'utilisateur lirait comme « aucun
 * résultat ».
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

  const ecrire = useCallback(
    (modifications: Record<string, string | undefined>) => {
      const suivants = new URLSearchParams(parametres.toString());

      for (const [cle, valeur] of Object.entries(modifications)) {
        if (valeur === undefined || valeur === "") suivants.delete(cle);
        else suivants.set(cle, valeur);
      }

      const requete = suivants.toString();
      // `scroll: false` : changer de page ne doit pas renvoyer l'utilisateur en haut de la liste.
      router.replace(requete ? `${chemin}?${requete}` : chemin, { scroll: false });
    },
    [chemin, parametres, router],
  );

  const definirFiltre = useCallback(
    (cle: keyof T, valeur: string | undefined) => {
      // Un changement de filtre remet à la première page.
      ecrire({ [String(cle)]: valeur, page: undefined });
    },
    [ecrire],
  );

  const definirPage = useCallback(
    (suivante: number) => ecrire({ page: suivante > 0 ? String(suivante) : undefined }),
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

  return { filtres, page, definirFiltre, definirPage, effacer, nbFiltresActifs };
}
