import { TAILLE_PAGE } from "@/hooks/const";
import { apiClient } from "@/lib/api/client";
import type { JournalSysteme } from "@/types/domaine";

/** Filtres du journal. Tous facultatifs : sans aucun, on lit le journal entier, du plus récent. */
export interface FiltresJournal {
  utilisateurId?: number;
  /** Code typé (backend Q-111), jamais le libellé : un texte libre ne se filtre pas sans mentir. */
  code?: string;
  dateDebut?: string;
  dateFin?: string;
}

/**
 * Journal des actions historisées hors dossier (backend Q-110).
 *
 * **Le manque qu'il comble.** RG-DOS-06 historise chaque modification, mais le seul point de lecture
 * partait d'un dossier : les actions qui n'en ont pas — modifications de paramètres système,
 * indexations de jurisprudence — étaient écrites et jamais relues. « Qui a abaissé le seuil de
 * validation conjointe ? » exigeait une requête en base. Q-108, en ouvrant l'administration à la
 * DJA, a doublé le nombre de détenteurs de ce pouvoir sans lever cette impossibilité.
 */
export const journalService = {
  /** #— Q-110, DJ et DJA. Le backend refuse (400) une période dont le début suit la fin. */
  systeme: async (
    filtres: FiltresJournal = {},
    page = 0,
    size = TAILLE_PAGE,
  ): Promise<JournalSysteme> => {
    const { data } = await apiClient.get<JournalSysteme>("/historique/systeme", {
      params: {
        ...(filtres.utilisateurId ? { utilisateurId: filtres.utilisateurId } : {}),
        ...(filtres.code ? { code: filtres.code } : {}),
        ...(filtres.dateDebut ? { dateDebut: filtres.dateDebut } : {}),
        ...(filtres.dateFin ? { dateFin: filtres.dateFin } : {}),
        page,
        size,
      },
    });
    return data;
  },
};
