"use client";

import { useQuery } from "@tanstack/react-query";

import { CLES, TAILLE_PAGE } from "@/hooks/const";
import { journalService, type FiltresJournal } from "@/services/journalService";

/**
 * Journal des actions hors dossier (backend Q-110). DJ et DJA.
 *
 * **Pas de rafraîchissement automatique** : c'est une lecture d'exploitation que l'on consulte, pas
 * un compteur que l'on surveille. Une cadence n'apporterait rien et interrogerait un agrégat pour
 * rien.
 */
export function useJournalSysteme(filtres: FiltresJournal, page = 0, size = TAILLE_PAGE) {
  return useQuery({
    queryKey: [
      CLES.journalSysteme,
      filtres.utilisateurId ?? "tous",
      filtres.code ?? "toutes",
      filtres.dateDebut ?? "",
      filtres.dateFin ?? "",
      page,
      size,
    ],
    queryFn: () => journalService.systeme(filtres, page, size),
    // Les filtres changent souvent ; garder la page précédente évite que le tableau clignote entre
    // deux lectures et que la hauteur de la page saute sous le curseur.
    placeholderData: (precedent) => precedent,
  });
}
