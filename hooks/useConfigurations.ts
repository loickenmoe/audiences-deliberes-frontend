"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES } from "@/hooks/const";
import { alerteService } from "@/services/alerteService";
import { configurationService } from "@/services/configurationService";

/**
 * `CHARGE_MAX_AVOCAT` est un **seuil d'alerte** avant d'être une clé de configuration : le contrat
 * lui réserve `PUT /alertes/seuils` (#44, FR-ALR-01), rattaché au même écran 41. On emprunte donc
 * l'endpoint désigné plutôt que la voie générique — les deux aboutissent à la même ligne et à la
 * même validation côté backend, mais seul #44 porte la sémantique métier dans le journal d'audit.
 */
const CLE_SEUIL_ALERTE = "CHARGE_MAX_AVOCAT";

/** #47 — sept clés fixes ; elles ne changent qu'à la suite d'une décision d'administration. */
export function useConfigurations() {
  return useQuery({
    queryKey: [CLES.configurations],
    queryFn: () => configurationService.lister(),
  });
}

/**
 * #48 — DJ seul. Le backend renvoie la valeur **normalisée** : on remplace l'entrée par sa réponse
 * plutôt que par la saisie, sinon l'écran afficherait « pdf, xlsx » là où la base contient
 * « PDF,XLSX ».
 */
export function useModifierConfiguration() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ cle, valeur }: { cle: string; valeur: string }) =>
      cle === CLE_SEUIL_ALERTE
        ? alerteService.modifierSeuil(CLE_SEUIL_ALERTE, Number(valeur))
        : configurationService.modifier(cle, valeur),
    onSuccess: () => client.invalidateQueries({ queryKey: [CLES.configurations] }),
  });
}
