import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { ErreurApi } from "@/lib/api/errors";

/**
 * Attaches a backend error to the form field it concerns.
 *
 * The backend is the source of truth: it names the faulty field in `champ` (`ERR-CONFLICT` covers
 * unrelated conflicts and `details` is human text). `correspondances` is a compatibility fallback
 * for backends that do not return `champ`; the form knows which endpoint it calls.
 *
 * Returns `true` if a field was found; `false` if the error must be shown at form level.
 */
const CHAMP_PAR_CODE: Readonly<Record<string, string>> = {
  "ERR-002": "reference",
  "ERR-006": "referenceFacture",
};

export function appliquerErreurApi<T extends FieldValues>(
  erreur: unknown,
  setError: UseFormSetError<T>,
  champsConnus: readonly string[],
  correspondances?: Readonly<Record<string, string>>,
): boolean {
  if (!(erreur instanceof ErreurApi)) return false;

  const champ = erreur.champ ?? { ...CHAMP_PAR_CODE, ...correspondances }[erreur.code];
  if (champ && champsConnus.includes(champ)) {
    setError(champ as Path<T>, { type: "server", message: erreur.message });
    return true;
  }

  return false;
}
