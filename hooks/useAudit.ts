"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES, TAILLE_PAGE } from "@/hooks/const";
import { auditService, type FiltresAudit } from "@/services/auditService";

/**
 * Consultation de l'audit (backend Q-112). DJ et DJA.
 *
 * **Pas de rafraîchissement automatique**, et ici la raison n'est pas seulement l'utilité : chaque
 * lecture de la première page est **historisée** côté serveur. Une cadence de fond produirait une
 * trace de consultations que personne n'a demandées, et noierait celles qui comptent.
 *
 * `placeholderData` conserve la page précédente pendant le chargement de la suivante : les filtres
 * changent souvent, et un tableau qui se vide entre deux lectures fait sauter la hauteur de la page
 * sous le curseur.
 */
export function useAudit(filtres: FiltresAudit, page = 0, size = TAILLE_PAGE) {
  return useQuery({
    queryKey: [
      CLES.audit,
      filtres.perimetre ?? "TOUT",
      filtres.dossierId ?? "",
      filtres.utilisateurId ?? "tous",
      filtres.code ?? "toutes",
      filtres.dateDebut ?? "",
      filtres.dateFin ?? "",
      page,
      size,
    ],
    queryFn: () => auditService.consulter(filtres, page, size),
    placeholderData: (precedent) => precedent,
  });
}

/** Les archives déjà produites (backend Q-113), avec leur empreinte. */
export function useArchivesAudit(page = 0, size = TAILLE_PAGE) {
  return useQuery({
    queryKey: [CLES.audit, "archives", page, size],
    queryFn: () => auditService.archives(page, size),
  });
}

/**
 * Produit une extraction et la remet à l'utilisateur (backend Q-113).
 *
 * **Le succès invalide la liste des archives** : l'export vient d'en créer une, et voir la liste
 * l'ignorer ferait croire que rien n'a été scellé — le même défaut que celui trouvé en Q-110 sur le
 * journal qui ne se rafraîchissait pas après un enregistrement.
 */
export function useExporterAudit() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      filtres,
      format,
    }: {
      filtres: FiltresAudit & { dateDebut: string; dateFin: string };
      format: "PDF" | "EXCEL";
    }) => auditService.exporter(filtres, format),
    onSuccess: () => client.invalidateQueries({ queryKey: [CLES.audit, "archives"] }),
  });
}
