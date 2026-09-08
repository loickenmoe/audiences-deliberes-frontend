import type { useTranslations } from "next-intl";

/**
 * Résolution des libellés d'affichage.
 *
 * Le backend ne renvoie **que des codes** (`EN_DELIBERE`, `SAISIE_IMMOBILIERE`, `ERR-002`) : aucun
 * libellé, dans aucune langue. C'est ce qui rend l'application traduisible sans modification du
 * backend — chaque code est une clé dans `messages/fr.json` et `messages/en.json`.
 *
 * Ne jamais afficher un code brut à l'utilisateur, ni le mettre en forme à la main dans un
 * composant.
 */
type Traducteur = ReturnType<typeof useTranslations>;

/**
 * Libellé d'une valeur d'énumération du domaine.
 * `t` doit être obtenu sur l'espace `domaine`.
 */
export function libelleDomaine(t: Traducteur, enumeration: string, valeur: string): string {
  return t(`${enumeration}.${valeur}` as Parameters<Traducteur>[0]);
}

/**
 * Message d'erreur à afficher, à partir du **code** renvoyé par le backend.
 *
 * On préfère notre propre message à celui du backend : ce dernier n'existe qu'en français. Le
 * message du backend ne sert que de repli, pour un code inconnu — mieux vaut une phrase en
 * français qu'un code technique.
 */
export function libelleErreur(
  t: Traducteur,
  code: string,
  messageBackend?: string | null,
): string {
  const cle = code as Parameters<Traducteur>[0];
  const traduit = t.has(cle) ? t(cle) : null;
  return traduit ?? messageBackend ?? t("generique" as Parameters<Traducteur>[0]);
}
