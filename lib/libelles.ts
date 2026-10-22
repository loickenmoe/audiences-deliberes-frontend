import type { useTranslations } from "next-intl";

/**
 * Display label resolution.
 *
 * The backend only returns codes (`EN_DELIBERE`, `SAISIE_IMMOBILIERE`, `ERR-002`); each code is a
 * key in `messages/fr.json` and `messages/en.json`. Never display a raw code to the user.
 */
type Traducteur = ReturnType<typeof useTranslations>;

/** Label of a domain enum value. `t` must come from the `domaine` namespace. */
export function libelleDomaine(t: Traducteur, enumeration: string, valeur: string): string {
  return t(`${enumeration}.${valeur}`);
}

/**
 * Error message from the backend code. The translated message is preferred (the backend message is
 * French only); the backend message is a fallback for unknown codes.
 */
export function libelleErreur(
  t: Traducteur,
  code: string,
  messageBackend?: string | null,
): string {
  const cle = code;
  const traduit = t.has(cle) ? t(cle) : null;
  return traduit ?? messageBackend ?? t("generique" as Parameters<Traducteur>[0]);
}
