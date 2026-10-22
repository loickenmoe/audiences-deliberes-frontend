"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES, TAILLE_PAGE } from "@/hooks/const";
import { auditService, type FiltresAudit } from "@/services/auditService";

/**
 * Audit log consultation (DJ and DJA). No automatic refresh: each read of the first page is itself
 * logged server-side, so background polling would pollute the trail.
 * `placeholderData` keeps the previous page while the next one loads to avoid layout jumps.
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

/** Archives already produced, with their fingerprint. */
export function useArchivesAudit(page = 0, size = TAILLE_PAGE) {
  return useQuery({
    queryKey: [CLES.audit, "archives", page, size],
    queryFn: () => auditService.archives(page, size),
  });
}

/**
 * Produces an export and hands it to the user. Success invalidates the archive list, since the
 * export has just created a new archive.
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
