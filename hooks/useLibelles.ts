"use client";

import { useMemo } from "react";

import { useIntervenants } from "@/hooks/useIntervenants";
import { useUtilisateurs } from "@/hooks/useReferentiels";

/**
 * Résolution des identifiants numériques en noms lisibles.
 *
 * **Le backend ne renvoie jamais de nom.** Un dossier expose `juristesAffectes: [3, 7]`, une alerte
 * un `destinataireId`, un document un `auteurChargementId`. Sans cette résolution, l'interface
 * afficherait des numéros.
 *
 * Les deux annuaires étant petits, fermés et mis en cache longuement (30 min), les résoudre côté
 * client évite autant d'allers-retours que de lignes affichées.
 *
 * ⚠ Un juriste **jamais connecté** n'apparaît pas dans l'annuaire (QF-16, provisionnement
 * paresseux) : `nomUtilisateur` retombe alors sur l'identifiant, plutôt que sur un blanc qui
 * laisserait croire à un défaut d'affichage.
 */
export function useLibelles() {
  const utilisateurs = useUtilisateurs();
  const intervenants = useIntervenants();

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
    for (const i of intervenants.data ?? []) table.set(i.id, i.nom);
    return table;
  }, [intervenants.data]);

  return {
    nomUtilisateur: (id: number) => parUtilisateur.get(id) ?? `#${id}`,
    nomIntervenant: (id: number) => parIntervenant.get(id) ?? `#${id}`,
    chargement: utilisateurs.isLoading || intervenants.isLoading,
  };
}
