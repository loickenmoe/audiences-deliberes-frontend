"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES } from "@/hooks/const";
import { alerteService } from "@/services/alerteService";
import { configurationService } from "@/services/configurationService";

/**
 * `CHARGE_MAX_AVOCAT` is an alert threshold: the contract assigns it `PUT /alertes/seuils` (#44,
 * FR-ALR-01). That endpoint is used instead of the generic one; both update the same row with the
 * same validation, but only #44 records the business meaning in the audit log.
 */
const CLE_SEUIL_ALERTE = "CHARGE_MAX_AVOCAT";

/** #47: fixed set of keys defined by backend migrations. */
export function useConfigurations() {
  return useQuery({
    queryKey: [CLES.configurations],
    queryFn: () => configurationService.lister(),
  });
}

/**
 * #48: DJ only. The backend returns the normalized value, so the screen shows the stored value
 * (e.g. "PDF,XLSX") rather than the raw input.
 */
export function useModifierConfiguration() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ cle, valeur }: { cle: string; valeur: string }) =>
      cle === CLE_SEUIL_ALERTE
        ? alerteService.modifierSeuil(CLE_SEUIL_ALERTE, Number(valeur))
        : configurationService.modifier(cle, valeur),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [CLES.configurations] });
      // The audit just recorded this change and the settings screen shows "modified on ... by ..."
      // per row, so the audit cache must be refreshed too.
      void client.invalidateQueries({ queryKey: [CLES.audit] });
    },
  });
}
