import { expect, type Page } from "@playwright/test";

/**
 * Affecter un dossier dans le formulaire de création — au moins un juriste et un avocat.
 *
 * **Pourquoi une aide.** Les juristes se choisissent par cases à cocher, les avocats par une
 * recherche avec jetons (2026-09-22). Huit spécifications créaient un dossier en sélectionnant « le
 * premier de chaque liste » dans une liste native ; elles passent désormais toutes par ici, pour
 * changer de geste sans changer ce qu'elles vérifient.
 *
 * Le juriste connecté est coché d'office : l'aide ne coche le premier juriste que si aucun ne l'est
 * — ce qui arrive quand c'est le DJ qui crée le dossier. L'avocat est le premier proposé, ou celui
 * qu'on nomme : un parcours qui a besoin d'un avocat précis le désigne par son nom.
 */
export async function affecterParDefaut(page: Page, options: { avocat?: string } = {}) {
  const juristes = page.getByRole("group", { name: "Juristes affectés" });
  await expect(juristes.getByRole("checkbox").first()).toBeVisible({ timeout: 30_000 });
  if ((await juristes.getByRole("checkbox", { checked: true }).count()) === 0) {
    await juristes.getByRole("checkbox").first().check();
  }

  const champ = page.getByRole("combobox", { name: "Avocats affectés" });
  await champ.click();
  if (options.avocat) await champ.fill(options.avocat);
  // Dans la liste des avocats, et non dans la page : la première option de la page est celle,
  // masquée, du sélecteur natif « Nature du dossier ».
  const liste = page.getByRole("listbox", { name: "Avocats affectés" });
  const option = options.avocat
    ? liste.getByRole("option", { name: options.avocat, exact: true })
    : liste.getByRole("option").first();
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  await champ.press("Escape");
  await expect(page.getByRole("button", { name: /Retirer$/ }).first()).toBeVisible();
}
