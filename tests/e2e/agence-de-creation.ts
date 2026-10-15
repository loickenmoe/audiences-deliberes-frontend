import { expect, type Page } from "@playwright/test";

/**
 * Choisit l'agence d'origine dans le formulaire de création d'un dossier.
 *
 * **Obligatoire depuis le 2026-10-05** (métier, observation 2) : le code d'agence n'est plus un
 * champ de texte libre mais un choix dans le référentiel des 82 agences, et le backend refuse la
 * création sans lui. Tous les parcours qui créent un dossier par l'écran passent donc ici.
 *
 * On prend la **première option proposée**, sans la nommer : le référentiel est chargé par la
 * migration V42 et son contenu doit être relu par le métier. Un code écrit en dur dans les tests
 * casserait le jour où une agence est fermée ou renommée - et c'est exactement le genre de donnée
 * qu'on ne doit pas inventer.
 */
export async function choisirAgenceOrigine(page: Page) {
  const champ = page.getByRole("combobox", { name: /Agence d.origine/ });
  await champ.click();
  const liste = page.getByRole("listbox", { name: /Agence d.origine/ });
  const option = liste.getByRole("option").first();
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  /*
   * Le champ porte désormais « code · nom · ville ». On vérifie qu'il n'est plus vide plutôt que
   * d'y comparer le texte de l'option : celui-ci inclut l'adresse, seconde ligne qui distingue les
   * agences homonymes, et `textContent` la recolle au libellé sans séparateur.
   */
  await expect(champ).not.toHaveValue("");
  return (await champ.inputValue()).trim();
}
