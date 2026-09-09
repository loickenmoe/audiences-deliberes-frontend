import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { ErreurApi } from "@/lib/api/errors";

/**
 * Reporte une erreur du backend sur le champ qu'elle concerne.
 *
 * Afficher « La référence client est déjà utilisée » dans un bandeau au-dessus d'un formulaire
 * laisse l'utilisateur chercher lequel de ses champs corriger. Rattacher le message au champ le lui
 * dit.
 *
 * **Le backend est la source de vérité.** Depuis QF-21, il nomme lui-même le champ fautif dans
 * `champ` — la seule information fiable, puisque `ERR-CONFLICT` sert à une dizaine de conflits sans
 * rapport et que `details` porte du texte pour un humain, pas un identifiant.
 *
 * `correspondances` reste un **repli de compatibilité** : le frontend et le backend sont deux dépôts
 * déployés séparément, et un backend antérieur à cet ajout ne renvoie pas `champ`. Le formulaire,
 * seul à savoir quel endpoint il appelle, peut alors désigner la cible. À supprimer quand plus
 * aucun environnement ne fera tourner un backend d'avant le 2026-09-09.
 *
 * Retourne `true` si l'erreur a trouvé un champ ; `false` si elle doit remonter au formulaire.
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
