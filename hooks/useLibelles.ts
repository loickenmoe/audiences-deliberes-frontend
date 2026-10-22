"use client";

import { useMemo } from "react";

import { TAILLE_ANNUAIRE } from "@/hooks/const";
import { useIntervenants } from "@/hooks/useIntervenants";
import { useUtilisateurs } from "@/hooks/useReferentiels";

/**
 * Resolves numeric ids into display names: the backend never returns names (e.g.
 * `juristesAffectes: [3, 7]`). Both directories are small and cached for 30 min, so resolving
 * client-side avoids one round-trip per row.
 * A user who has never logged in is not in the directory (lazy provisioning): `nomUtilisateur`
 * then falls back to the id rather than a blank.
 */
export function useLibelles() {
  const utilisateurs = useUtilisateurs();
  // The lookup table needs the whole directory, not a page (see TAILLE_ANNUAIRE).
  const intervenants = useIntervenants({ size: TAILLE_ANNUAIRE });

  const parUtilisateur = useMemo(() => {
    const table = new Map<number, string>();
    for (const u of utilisateurs.data ?? []) {
      const nom = [u.prenom, u.nom].filter(Boolean).join(" ").trim();
      table.set(u.id, nom || u.email || `#${u.id}`);
    }
    return table;
  }, [utilisateurs.data]);

  const parIntervenant = useMemo(() => {
    const table = new Map<number, string>();
    for (const i of intervenants.data?.content ?? []) table.set(i.id, i.nom);
    return table;
  }, [intervenants.data]);

  return {
    nomUtilisateur: (id: number) => parUtilisateur.get(id) ?? `#${id}`,
    nomIntervenant: (id: number) => parIntervenant.get(id) ?? `#${id}`,
    chargement: utilisateurs.isLoading || intervenants.isLoading,
  };
}
