import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { ErreurApi } from "@/lib/api/errors";

/**
 * Reporte une erreur du backend sur les champs d'un formulaire.
 *
 * Le backend signale les violations de validation par `ERR-001` (métadonnées manquantes) ou
 * `ERR-VALIDATION`, avec le détail dans `details`. Certains codes visent en revanche un **champ
 * précis et connu** : une référence de dossier en doublon concerne `reference`, une facture en
 * doublon concerne `referenceFacture`. Les rattacher au bon champ évite d'afficher un bandeau
 * générique au-dessus d'un formulaire de vingt champs.
 *
 * Retourne `true` si l'erreur a pu être placée sur un champ ; `false` si elle doit être affichée
 * au niveau du formulaire.
 */
const CHAMP_PAR_CODE: Record<string, string> = {
  "ERR-002": "reference",
  "ERR-006": "referenceFacture",
};

export function appliquerErreurApi<T extends FieldValues>(
  erreur: unknown,
  setError: UseFormSetError<T>,
  champsConnus: readonly string[],
): boolean {
  if (!(erreur instanceof ErreurApi)) return false;

  const champ = CHAMP_PAR_CODE[erreur.code];
  if (champ && champsConnus.includes(champ)) {
    setError(champ as Path<T>, { type: "server", message: erreur.message });
    return true;
  }

  return false;
}
